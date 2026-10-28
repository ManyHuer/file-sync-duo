import { spawnSync } from "node:child_process";
import process from "node:process";

const requireMaestro = process.argv.includes("--require-maestro");

const probe = spawnSync("maestro", ["-v"], { shell: true, encoding: "utf8" });

if (probe.status !== 0) {
  console.log("");
  console.log("Maestro no está instalado. Los flujos de mobile quedan omitidos.");
  console.log("");
  console.log("Instalación (macOS/Linux/WSL):");
  console.log('  curl -Ls "https://get.maestro.mobile.dev" | bash');
  console.log("");
  console.log("Requisitos: emulador o dispositivo Android con la app instalada.");
  console.log("Ver apps/mobile/.maestro/README.md");
  if (requireMaestro) process.exit(1);
  process.exit(0);
}

const missing = ["OWNER", "REPO", "TOKEN"].filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.warn(
    `Aviso: faltan ${missing.join(", ")}. Si la app ya está configurada, los flujos funcionan igual.`,
  );
}

const args = [
  "test",
  ".maestro",
  "-e",
  `OWNER=${process.env.OWNER ?? ""}`,
  "-e",
  `REPO=${process.env.REPO ?? ""}`,
  "-e",
  `TOKEN=${process.env.TOKEN ?? ""}`,
];

const result = spawnSync("maestro", args, { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
