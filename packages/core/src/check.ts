import { conflictName, hasConflictSuffix } from "./conflict";
import { findOrphans, isHiddenPath, sync } from "./sync";
import { DriveClient, LocalFS } from "./types";

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed++;
    console.error(`FAIL: ${msg}`);
  }
}

const sample = "# Nota con acentos: ñ á é í ó ú ¿?";
assert(base64ToUtf8(utf8ToBase64(sample)) === sample, "base64 roundtrip con acentos");

const name = conflictName("nota.md");
assert(name !== "nota.md", "el nombre debe cambiar");
assert(name.startsWith("nota_conflict_"), "debe conservar el prefijo");
assert(name.endsWith(".md"), "debe conservar la extensión");
assert(!hasConflictSuffix("nota.md"), "archivo normal no es conflicto");
assert(hasConflictSuffix(name), "copia generada debe detectarse como conflicto");
assert(hasConflictSuffix("a_conflict_2026-08-09_14-30-00.md"), "conflicto con timestamp detectado");
assert(hasConflictSuffix("x_conflict_2026-08-09_14-30-00.txt"), "conflicto con otra extensión detectado");

assert(isHiddenPath(".git/nota.md"), "carpeta oculta detectada");
assert(isHiddenPath(".secret.md"), "archivo oculto detectado");
assert(isHiddenPath("carpeta/.oculto/nota.md"), "subcarpeta oculta detectada");
assert(!isHiddenPath("carpeta/nota.md"), "path normal no es oculto");
assert(!isHiddenPath("nota.md"), "archivo normal no es oculto");

if (failed > 0) {
  console.error(`${failed} assertions fallaron`);
  process.exit(1);
}
console.log(`OK: conflictName("nota.md") -> "${name}"`);

const fakeClient: DriveClient = {
  listFiles: async () => [
    { id: "a.md", name: "a.md", modifiedTime: "2026-01-01T00:00:00.000Z" },
    { id: "b.md", name: "b.md", modifiedTime: "2026-01-01T00:00:00.000Z" },
  ],
  upload: async () => {},
  download: async () => "",
  touch: async () => {},
  delete: async () => {},
  commitMeta: async () => {},
};

const fakeFs: LocalFS = {
  list: async () => [
    { name: "a.md", modifiedTime: 1 },
    { name: "c.md", modifiedTime: 1 },
  ],
  read: async () => "",
  write: async () => {},
  stat: async () => 1,
  setMtime: async () => {},
  delete: async () => {},
};

(async () => {
  const pushOrphans = await findOrphans(fakeClient, fakeFs, "push");
  assert(pushOrphans.length === 1 && pushOrphans[0] === "b.md", "push: b.md existe en repo pero no local");
  const pullOrphans = await findOrphans(fakeClient, fakeFs, "pull");
  assert(pullOrphans.length === 1 && pullOrphans[0] === "c.md", "pull: c.md existe local pero no en repo");
  if (failed > 0) {
    console.error(`${failed} assertions fallaron`);
    process.exit(1);
  }
  console.log("OK: findOrphans detecta archivos huérfanos en ambas direcciones");

  const remoteTime = Date.parse("2026-01-01T00:00:00.000Z");
  const writes: Record<string, string> = {};
  const mtimes: Record<string, number> = {};
  const uploads: Record<string, string> = {};
  const conflictClient: DriveClient = {
    listFiles: async () => [{ id: "x.md", name: "x.md", modifiedTime: new Date(remoteTime).toISOString() }],
    upload: async (name, content, modifiedTime) => {
      uploads[name] = content;
      mtimes[name] = modifiedTime;
    },
    download: async () => "CONTENIDO_REMOTO",
    touch: async (name, modifiedTime) => {
      mtimes[name] = modifiedTime;
    },
    delete: async () => {},
    commitMeta: async () => {},
  };
  const conflictFs: LocalFS = {
    list: async () => [{ name: "x.md", modifiedTime: remoteTime + 1000 }],
    read: async () => "contenido local",
    write: async (name, content) => {
      writes[name] = content;
    },
    stat: async () => remoteTime + 1000,
    setMtime: async (name, modifiedTime) => {
      mtimes[name] = modifiedTime;
    },
    delete: async () => {},
  };

  (async () => {
    const s = sync(conflictClient, conflictFs);
    const pullSummary = await s.pull();
    assert(pullSummary.conflicts.length === 1 && pullSummary.conflicts[0] === "x.md", "pull: conflicto detectado");
    const copyName = Object.keys(writes).find((n) => hasConflictSuffix(n));
    assert(!!copyName, "pull: copia de conflicto creada en local");
    assert(copyName && writes[copyName] === "contenido local", "pull: copia contiene la versión local");
    assert(writes["x.md"] === "CONTENIDO_REMOTO", "pull: el remoto gana como archivo original");
    assert(mtimes["x.md"] === remoteTime, "pull: mtime del original igualado al remoto");

    const pushWrites: Record<string, string> = {};
    const pushUploads: Record<string, string> = {};
    const pushFs: LocalFS = {
      list: async () => [{ name: "x.md", modifiedTime: remoteTime - 1000 }],
      read: async () => "contenido local",
      write: async (name, content) => {
        pushWrites[name] = content;
      },
      stat: async () => remoteTime - 1000,
      setMtime: async (name, modifiedTime) => {
        mtimes[name] = modifiedTime;
      },
      delete: async () => {},
    };
    const pushClient: DriveClient = {
      ...conflictClient,
      upload: async (name, content, modifiedTime) => {
        pushUploads[name] = content;
        mtimes[name] = modifiedTime;
      },
    };
    const pushSummary = await sync(pushClient, pushFs).push();
    assert(pushSummary.conflicts.length === 1 && pushSummary.conflicts[0] === "x.md", "push: conflicto detectado");
    assert(pushUploads["x.md"] === "contenido local", "push: el local gana como archivo original en GitHub");
    const pushCopy = Object.keys(pushWrites).find((n) => hasConflictSuffix(n));
    assert(!!pushCopy, "push: copia de conflicto creada en local");
    assert(pushCopy && pushWrites[pushCopy] === "CONTENIDO_REMOTO", "push: copia local contiene la versión remota");

    if (failed > 0) {
      console.error(`${failed} assertions fallaron`);
      process.exit(1);
    }
    console.log("OK: los conflictos crean copia local y la operación gana como archivo original");
  })();
})();
