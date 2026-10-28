import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../src/github";

const TOKEN = "ghp_secreto_de_prueba";
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function base64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

function newClient(): GitHubClient {
  return new GitHubClient({ owner: "owner", repo: "repo", token: TOKEN });
}

describe("GitHubClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("descarga y decodifica UTF-8", async () => {
    fetchMock.mockResolvedValueOnce(response({ content: base64("hola ñ áéíóú") }));

    const text = await newClient().download("nota.md");

    expect(text).toBe("hola ñ áéíóú");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/contents/nota.md");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("sube un archivo nuevo y actualiza los metadatos", async () => {
    fetchMock
      .mockResolvedValueOnce(response("not found", 404)) // meta
      .mockResolvedValueOnce(response("not found", 404)) // sha
      .mockResolvedValueOnce(response({ content: { sha: "file-sha" } }, 201)); // PUT

    const client = newClient();
    await client.upload("nota.md", "contenido", T0);

    const putCall = fetchMock.mock.calls[2];
    expect((putCall[1] as RequestInit).method).toBe("PUT");
    const body = JSON.parse(String((putCall[1] as RequestInit).body));
    expect(body.message).toBe("sync nota.md");
    expect(Buffer.from(body.content, "base64").toString("utf8")).toBe("contenido");
    expect(body.sha).toBeUndefined();

    fetchMock.mockResolvedValueOnce(response({ content: { sha: "meta-sha" } }));
    await client.commitMeta();

    const metaCall = fetchMock.mock.calls[3];
    const metaBody = JSON.parse(String((metaCall[1] as RequestInit).body));
    expect(JSON.parse(Buffer.from(metaBody.content, "base64").toString("utf8"))).toEqual({
      "nota.md": T0,
    });
  });

  it("incluye el sha cuando el archivo ya existe", async () => {
    fetchMock
      .mockResolvedValueOnce(response("not found", 404))
      .mockResolvedValueOnce(response({ sha: "existente" }))
      .mockResolvedValueOnce(response({ content: { sha: "nuevo" } }));

    await newClient().upload("nota.md", "x", T0);

    const body = JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body));
    expect(body.sha).toBe("existente");
  });

  it("traduce 401 a TOKEN_EXPIRED sin filtrar el token", async () => {
    fetchMock.mockResolvedValueOnce(response("no autorizado", 401));

    const error = await newClient().download("nota.md").catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("TOKEN_EXPIRED");
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it("reporta errores HTTP con cuerpo acotado y sin token", async () => {
    fetchMock.mockResolvedValueOnce(response("boom interno", 500));

    const error = await newClient().download("nota.md").catch((e: Error) => e);

    expect((error as Error).message).toBe("GitHub API 500: boom interno");
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it("reporta timeout cuando fetch aborta", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));

    const error = await newClient().download("nota.md").catch((e: Error) => e);

    expect((error as Error).message).toContain("timeout");
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it("lista archivos .md del root y de un subdirectorio", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ content: base64(JSON.stringify({ "a.md": T0 })), sha: "meta" }))
      .mockResolvedValueOnce(
        response([
          { name: "a.md", type: "file" },
          { name: "nota.txt", type: "file" },
          { name: "folder", type: "dir" },
        ]),
      )
      .mockResolvedValueOnce(response([{ name: "b.md", type: "file" }]));

    const files = await newClient().listFiles();

    expect(files).toEqual([
      { id: "a.md", name: "a.md", modifiedTime: new Date(T0).toISOString() },
      { id: "folder/b.md", name: "folder/b.md", modifiedTime: new Date(0).toISOString() },
    ]);
  });

  it("devuelve lista vacía si el repositorio está vacío", async () => {
    fetchMock
      .mockResolvedValueOnce(response("not found", 404))
      .mockResolvedValueOnce(response("This repository is empty", 409));

    await expect(newClient().listFiles()).resolves.toEqual([]);
  });

  it("tolera la ausencia de metadatos remotos", async () => {
    fetchMock
      .mockResolvedValueOnce(response("not found", 404))
      .mockResolvedValueOnce(response([{ name: "a.md", type: "file" }]));

    const files = await newClient().listFiles();

    expect(files[0]?.modifiedTime).toBe(new Date(0).toISOString());
  });

  it("touch actualiza el mtime y commitMeta lo persiste", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ content: base64(JSON.stringify({ "nota.md": T0 })), sha: "meta" }))
      .mockResolvedValueOnce(response({ content: { sha: "meta-2" } }));

    const client = newClient();
    await client.touch("nota.md", T0 + 5000);
    await client.commitMeta();

    const body = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(JSON.parse(Buffer.from(body.content, "base64").toString("utf8"))).toEqual({
      "nota.md": T0 + 5000,
    });
  });

  it("delete borra el archivo remoto y lo quita de los metadatos", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ sha: "file-sha" })) // getFileSha
      .mockResolvedValueOnce(response({})) // DELETE
      .mockResolvedValueOnce(
        response({ content: base64(JSON.stringify({ "nota.md": T0, "otro.md": T0 })), sha: "meta" }),
      ) // loadMeta
      .mockResolvedValueOnce(response({ content: { sha: "meta-2" } })); // commitMeta

    const client = newClient();
    await client.delete("nota.md");
    await client.commitMeta();

    const deleteCall = fetchMock.mock.calls[1];
    expect((deleteCall[1] as RequestInit).method).toBe("DELETE");
    expect(JSON.parse(String((deleteCall[1] as RequestInit).body)).sha).toBe("file-sha");

    const metaCall = fetchMock.mock.calls[3];
    const metaBody = JSON.parse(String((metaCall[1] as RequestInit).body));
    expect(JSON.parse(Buffer.from(metaBody.content, "base64").toString("utf8"))).toEqual({
      "otro.md": T0,
    });
  });

  it("delete no llama a la API si el archivo no existe", async () => {
    fetchMock.mockResolvedValueOnce(response("not found", 404));

    await newClient().delete("fantasma.md");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
