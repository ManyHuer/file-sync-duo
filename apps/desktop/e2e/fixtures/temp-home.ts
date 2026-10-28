import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface TempHome {
  path: string;
  cleanup: () => void;
}

/**
 * Crea un directorio aislado que simula Documents/FileSync.
 * El proceso principal de Electron lo usa vía FILESYNC_HOME.
 */
export function createTempHome(): TempHome {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "filesync-e2e-"));

  fs.writeFileSync(path.join(home, "nota.md"), "# Nota de prueba\n", "utf8");
  fs.mkdirSync(path.join(home, "proyectos"), { recursive: true });

  return {
    path: home,
    cleanup: () => fs.rmSync(home, { recursive: true, force: true }),
  };
}
