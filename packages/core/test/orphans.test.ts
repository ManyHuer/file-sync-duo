import { describe, expect, it } from "vitest";
import { findOrphans, isHiddenPath } from "../src/sync";
import { FakeDriveClient, FakeLocalFS, T0 } from "./helpers/fakes";

describe("isHiddenPath", () => {
  it("detecta archivos y carpetas ocultas", () => {
    expect(isHiddenPath(".git/nota.md")).toBe(true);
    expect(isHiddenPath(".secret.md")).toBe(true);
    expect(isHiddenPath("carpeta/.oculto/nota.md")).toBe(true);
  });

  it("no marca rutas normales", () => {
    expect(isHiddenPath("carpeta/nota.md")).toBe(false);
    expect(isHiddenPath("nota.md")).toBe(false);
  });
});

describe("findOrphans", () => {
  function build() {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("solo-remoto.md", "r", T0);
    client.seed("ambos.md", "r", T0);
    client.seed(".oculto.md", "r", T0);
    client.seed("nota.txt", "r", T0);
    fs.seed("solo-local.md", "l", T0);
    fs.seed("ambos.md", "l", T0);
    fs.seed(".oculto-local.md", "l", T0);
    return { client, fs };
  }

  it("push reporta archivos que existen en remoto pero no en local", async () => {
    const { client, fs } = build();
    expect(await findOrphans(client, fs, "push")).toEqual(["solo-remoto.md"]);
  });

  it("pull reporta archivos que existen en local pero no en remoto", async () => {
    const { client, fs } = build();
    expect(await findOrphans(client, fs, "pull")).toEqual(["solo-local.md"]);
  });

  it("ignora archivos que no son .md y rutas ocultas", async () => {
    const { client, fs } = build();
    const push = await findOrphans(client, fs, "push");
    const pull = await findOrphans(client, fs, "pull");
    expect(push).not.toContain("nota.txt");
    expect(push).not.toContain(".oculto.md");
    expect(pull).not.toContain(".oculto-local.md");
  });

  it("devuelve listas vacías cuando ambos lados coinciden", async () => {
    const client = new FakeDriveClient();
    const fs = new FakeLocalFS();
    client.seed("a.md", "x", T0);
    fs.seed("a.md", "x", T0);
    expect(await findOrphans(client, fs, "push")).toEqual([]);
    expect(await findOrphans(client, fs, "pull")).toEqual([]);
  });
});
