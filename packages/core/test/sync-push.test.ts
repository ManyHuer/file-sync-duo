import { describe, expect, it } from "vitest";
import { hasConflictSuffix } from "../src/conflict";
import { sync } from "../src/sync";
import { FakeDriveClient, FakeLocalFS, T0 } from "./helpers/fakes";

describe("sync.push", () => {
  it("sube archivos nuevos y confirma los metadatos", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    fs.seed("nueva.md", "contenido", T0);

    const summary = await sync(client, fs).push();

    expect(summary.uploaded).toEqual(["nueva.md"]);
    expect(summary.conflicts).toEqual([]);
    expect(client.uploads).toEqual([{ name: "nueva.md", content: "contenido", modifiedTime: T0 }]);
    expect(client.commitCount).toBe(1);
  });

  it("omite archivos ya sincronizados con el mismo contenido", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("igual.md", "mismo", T0);
    fs.seed("igual.md", "mismo", T0);

    const summary = await sync(client, fs).push();

    expect(summary.skipped).toEqual(["igual.md"]);
    expect(client.uploads).toEqual([]);
  });

  it("sube cuando el mtime coincide pero el contenido cambió", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("cambio.md", "viejo", T0);
    fs.seed("cambio.md", "nuevo", T0);

    const summary = await sync(client, fs).push();

    expect(summary.uploaded).toEqual(["cambio.md"]);
    expect(client.uploads[0]?.content).toBe("nuevo");
  });

  it("crea copia local cuando el remoto es más nuevo", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    const remoteTime = T0 + 1000;
    client.seed("x.md", "remoto", remoteTime);
    fs.seed("x.md", "local", T0);

    const summary = await sync(client, fs).push();

    expect(summary.conflicts).toEqual(["x.md"]);
    expect(client.uploads[0]).toEqual({ name: "x.md", content: "local", modifiedTime: T0 });
    const copy = fs.writes.find((w) => hasConflictSuffix(w.name));
    expect(copy?.content).toBe("remoto");
    expect(fs.files.get(copy!.name)?.modifiedTime).toBe(remoteTime);
  });

  it("sube cuando el remoto es más viejo", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("x.md", "remoto", T0 - 1000);
    fs.seed("x.md", "local", T0);

    const summary = await sync(client, fs).push();

    expect(summary.uploaded).toEqual(["x.md"]);
    expect(client.uploads[0]?.content).toBe("local");
  });

  it("ignora archivos ocultos y no-markdown", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    fs.seed(".oculto.md", "x", T0);
    fs.seed("notas.txt", "x", T0);
    fs.seed("visible.md", "x", T0);

    const summary = await sync(client, fs).push();

    expect(summary.uploaded).toEqual(["visible.md"]);
    expect(client.uploads.map((u) => u.name)).toEqual(["visible.md"]);
  });

  it("propaga el error y no confirma metadatos", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    fs.seed("falla.md", "x", T0);
    client.failNext = "TOKEN_EXPIRED";

    await expect(sync(client, fs).push()).rejects.toThrow("TOKEN_EXPIRED");
    expect(client.commitCount).toBe(0);
  });
});
