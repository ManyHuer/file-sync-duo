import { describe, expect, it } from "vitest";
import { hasConflictSuffix } from "../src/conflict";
import { findOrphans, sync } from "../src/sync";
import { FakeDriveClient, FakeLocalFS, T0 } from "./helpers/fakes";

describe("sync con carpetas anidadas", () => {
  it("sube archivos en subcarpetas profundas", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    fs.seed("proyectos/2026/nota.md", "contenido", T0);

    const summary = await sync(client, fs).push();

    expect(summary.uploaded).toEqual(["proyectos/2026/nota.md"]);
    expect(client.uploads).toEqual([
      { name: "proyectos/2026/nota.md", content: "contenido", modifiedTime: T0 },
    ]);
  });

  it("descarga archivos en subcarpetas profundas", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("proyectos/2026/nota.md", "remoto", T0);

    const summary = await sync(client, fs).pull();

    expect(summary.downloaded).toEqual(["proyectos/2026/nota.md"]);
    expect(fs.files.get("proyectos/2026/nota.md")).toEqual({ content: "remoto", modifiedTime: T0 });
    expect(client.files.get("proyectos/2026/nota.md")?.modifiedTime).toBe(T0);
  });

  it("crea la copia de conflicto dentro de la subcarpeta local", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    const localTime = T0 + 1000;
    client.seed("a/b/nota.md", "remoto", T0);
    fs.seed("a/b/nota.md", "local", localTime);

    const summary = await sync(client, fs).pull();

    expect(summary.conflicts).toEqual(["a/b/nota.md"]);
    const copy = fs.writes.find((w) => hasConflictSuffix(w.name));
    expect(copy?.name.startsWith("a/b/nota_conflict_")).toBe(true);
    expect(copy?.content).toBe("local");
    expect(fs.files.get("a/b/nota.md")?.content).toBe("remoto");
  });

  it("findOrphans no marca archivos anidados que existen en ambos lados", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("a/b/nota.md", "x", T0);
    fs.seed("a/b/nota.md", "x", T0);
    fs.seed("a/b/otra.md", "y", T0);

    await expect(findOrphans(client, fs, "push")).resolves.toEqual([]);
    await expect(findOrphans(client, fs, "pull")).resolves.toEqual(["a/b/otra.md"]);
  });
});
