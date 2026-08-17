import { conflictName, hasConflictSuffix } from "./conflict";
import { findOrphans, isHiddenPath } from "./sync";
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
})();
