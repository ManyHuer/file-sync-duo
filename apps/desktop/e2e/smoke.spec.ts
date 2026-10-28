import { expect, test } from "@playwright/test";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";
import fs from "node:fs";
import path from "node:path";
import { createTempHome, type TempHome } from "./fixtures/temp-home";

const OWNER = "test-owner";
const REPO = "test-repo";
const API_PREFIX = `/repos/${OWNER}/${REPO}/contents/`;

let app: ElectronApplication;
let page: Page;
let home: TempHome;

const remoteFiles = new Map<string, string>();
let remoteMeta: Record<string, number> = {};
let failNextUpload = false;

function base64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

async function installGitHubMock(target: Page): Promise<void> {
  await target.route("https://api.github.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const decoded = decodeURIComponent(url.pathname);
    const isMeta = decoded.endsWith("/.filesync-meta.json");
    const isRoot = decoded.endsWith("/contents") || decoded.endsWith("/contents/");
    const name = decoded.startsWith(API_PREFIX) ? decoded.slice(API_PREFIX.length) : "";

    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const notFound = () => json({ message: "Not Found" }, 404);

    // Latencia artificial para poder observar el estado ocupado de la UI.
    await new Promise((resolve) => setTimeout(resolve, 250));

    if (isMeta) {
      if (method === "GET") {
        if (Object.keys(remoteMeta).length === 0) return notFound();
        return json({ content: base64(JSON.stringify(remoteMeta)), sha: "meta-sha" });
      }
      if (method === "PUT") {
        const body = JSON.parse(request.postData() ?? "{}");
        remoteMeta = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
        return json({ content: { sha: "meta-sha" } });
      }
    }

    if (isRoot) {
      const dirs = new Set<string>();
      const files: Array<{ name: string; type: string }> = [];
      for (const remoteName of remoteFiles.keys()) {
        if (remoteName.includes("/")) dirs.add(remoteName.split("/")[0]);
        else files.push({ name: remoteName, type: "file" });
      }
      return json([...files, ...[...dirs].map((dir) => ({ name: dir, type: "dir" }))]);
    }

    if (method === "GET") {
      const content = remoteFiles.get(name);
      if (content === undefined) return notFound();
      return json({ content: base64(content), sha: `sha-${name}` });
    }

    if (method === "PUT") {
      if (failNextUpload) {
        failNextUpload = false;
        return json({ message: "fallo simulado de red" }, 500);
      }
      const body = JSON.parse(request.postData() ?? "{}");
      remoteFiles.set(name, Buffer.from(body.content, "base64").toString("utf8"));
      return json({ content: { sha: `sha-${name}` } });
    }

    if (method === "DELETE") {
      remoteFiles.delete(name);
      return json({});
    }

    return json({ message: `método no soportado: ${method}` }, 405);
  });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  home = createTempHome();

  app = await electron.launch({
    args: [path.resolve(__dirname, "..")],
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, FILESYNC_HOME: home.path } as Record<string, string>,
  });

  page = await app.firstWindow();
  await installGitHubMock(page);
  await page.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await app?.close();
  home?.cleanup();
});

test("configura, navega, sube, descarga y se recupera de un error", async () => {
  await expect(page.getByText("Configura tu repo de GitHub")).toBeVisible();

  await page.getByLabel("Usuario de GitHub").fill(OWNER);
  await page.getByLabel("Repositorio").fill(REPO);
  await page.getByLabel("Token de GitHub").fill("token-falso-de-prueba");
  await page.getByRole("button", { name: "Guardar conexión" }).click();

  await expect(page.getByText(`Conectado a ${OWNER}/${REPO}`)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("token-falso-de-prueba");

  // Navegación de carpetas
  await page.getByText("proyectos", { exact: true }).click();
  await expect(page.getByText(/Sincronizando solo la carpeta/)).toBeVisible();
  await expect(page.getByText("Esta carpeta está vacía")).toBeVisible();
  await page.locator(".back-btn").click();
  await expect(page.getByText("Archivos locales (.md)")).toBeVisible();

  // Subida
  const push = page.getByTestId("btn-push");
  await push.click();
  await expect(push).toBeDisabled();
  await expect(push).toHaveText("Subiendo...");
  await expect(page.getByText("Subidos: 1, Descargados: 0")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText("Subida completada: 1 subidos, conflictos: 0, sin cambios: 0"),
  ).toBeVisible();
  await expect(push).toBeEnabled();
  expect(remoteFiles.get("nota.md")).toContain("Nota de prueba");

  // Descarga sin cambios
  const pull = page.getByTestId("btn-pull");
  await pull.click();
  await expect(pull).toHaveText("Descargando...");
  await expect(page.getByText("Subidos: 0, Descargados: 0")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText("Descarga completada: 0 descargados, conflictos: 0, sin cambios: 1"),
  ).toBeVisible();
  await expect(pull).toBeEnabled();

  // Error de red: la UI debe mostrar el error y ofrecer reintento
  fs.writeFileSync(path.join(home.path, "nota.md"), "# Nota modificada\n", "utf8");
  failNextUpload = true;
  await push.click();
  await expect(page.locator(".error")).toContainText("fallo simulado", { timeout: 15_000 });
  await expect(push).toBeEnabled();
  await expect(page.locator(".error")).not.toContainText("token-falso-de-prueba");

  const retry = page.getByTestId("btn-retry");
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(
    page.getByText("Subida completada: 1 subidos, conflictos: 0, sin cambios: 0"),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".error")).toHaveCount(0);
});
