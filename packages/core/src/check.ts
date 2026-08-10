import { conflictName, hasConflictSuffix } from "./conflict";

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

if (failed > 0) {
  console.error(`${failed} assertions fallaron`);
  process.exit(1);
}
console.log(`OK: conflictName("nota.md") -> "${name}"`);
