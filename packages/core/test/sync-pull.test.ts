import { describe, expect, it } from "vitest";
import { hasConflictSuffix } from "../src/conflict";
import { sync } from "../src/sync";
import type { DriveClient } from "../src/types";
import { FakeDriveClient, FakeLocalFS, T0 } from "./helpers/fakes";

describe("sync.pull", () => {
  it("descarga archivos nuevos, ajusta mtime y confirma metadatos", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("nueva.md", "remoto", T0);

    const summary = await sync(client, fs).pull();

    expect(summary.downloaded).toEqual(["nueva.md"]);
    expect(fs.files.get("nueva.md")).toEqual({ content: "remoto", modifiedTime: T0 });
    expect(client.files.get("nueva.md")?.modifiedTime).toBe(T0);
    expect(client.commitCount).toBe(1);
  });

  it("omite archivos idénticos con el mismo mtime", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("igual.md", "mismo", T0);
    fs.seed("igual.md", "mismo", T0);

    const summary = await sync(client, fs).pull();

    expect(summary.skipped).toEqual(["igual.md"]);
    expect(fs.writes).toEqual([]);
  });

  it("crea copia local cuando el local es más nuevo", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    const localTime = T0 + 1000;
    client.seed("x.md", "remoto", T0);
    fs.seed("x.md", "local", localTime);

    const summary = await sync(client, fs).pull();

    expect(summary.conflicts).toEqual(["x.md"]);
    const copy = fs.writes.find((w) => hasConflictSuffix(w.name));
    expect(copy?.content).toBe("local");
    expect(fs.files.get("x.md")).toEqual({ content: "remoto", modifiedTime: T0 });
    expect(client.files.get("x.md")?.modifiedTime).toBe(T0);
  });

  it("crea copia local cuando el mtime coincide pero el contenido difiere", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("x.md", "remoto", T0);
    fs.seed("x.md", "local", T0);

    const summary = await sync(client, fs).pull();

    expect(summary.conflicts).toEqual(["x.md"]);
    expect(fs.writes.find((w) => hasConflictSuffix(w.name))?.content).toBe("local");
    expect(fs.files.get("x.md")?.content).toBe("remoto");
  });

  it("omite un archivo que ya no existe en GitHub", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("x.md", "remoto", T0);
    client.download = async () => {
      throw new Error("GitHub API 404: x.md");
    };

    const summary = await sync(client, fs).pull();

    expect(summary.skipped).toEqual(["x.md"]);
    expect(summary.downloaded).toEqual([]);
  });

  it("rechaza repos con demasiados archivos", async () => {
    const many: DriveClient = {
      listFiles: async () =>
        Array.from({ length: 2001 }, (_, i) => ({
          id: `f${i}.md`,
          name: `f${i}.md`,
          modifiedTime: new Date(T0).toISOString(),
        })),
      upload: async () => {},
      download: async () => "",
      touch: async () => {},
      delete: async () => {},
      commitMeta: async () => {},
    };

    await expect(sync(many, new FakeLocalFS()).pull()).rejects.toThrow("Demasiados archivos");
  });

  it("propaga errores que no son 404", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("x.md", "remoto", T0);
    client.failNext = "TOKEN_EXPIRED";

    await expect(sync(client, fs).pull()).rejects.toThrow("TOKEN_EXPIRED");
    expect(client.commitCount).toBe(0);
  });
});
