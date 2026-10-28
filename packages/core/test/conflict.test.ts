import { describe, expect, it } from "vitest";
import { conflictName, hasConflictSuffix } from "../src/conflict";

const SUFFIX = /_conflict_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/;

describe("conflictName", () => {
  it("conserva el nombre base y la extensión", () => {
    const name = conflictName("nota.md");
    expect(name.startsWith("nota_conflict_")).toBe(true);
    expect(name.endsWith(".md")).toBe(true);
    expect(name).toMatch(SUFFIX);
  });

  it("conserva la ruta de carpeta", () => {
    const name = conflictName("notas/diario.md");
    expect(name.startsWith("notas/diario_conflict_")).toBe(true);
    expect(name.endsWith(".md")).toBe(true);
  });

  it("funciona con archivos sin extensión", () => {
    const name = conflictName("README");
    expect(name.startsWith("README_conflict_")).toBe(true);
    expect(name).not.toContain("README.");
  });

  it("genera nombres distintos en llamadas distintas", async () => {
    const first = conflictName("a.md");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = conflictName("a.md");
    expect(first).not.toBe(second);
  });
});

describe("hasConflictSuffix", () => {
  it("detecta el sufijo generado", () => {
    expect(hasConflictSuffix("a_conflict_2026-08-09_14-30-00.md")).toBe(true);
    expect(hasConflictSuffix("a_conflict_2026-08-09_14-30-00.txt")).toBe(true);
  });

  it("rechaza nombres normales", () => {
    expect(hasConflictSuffix("nota.md")).toBe(false);
    expect(hasConflictSuffix("conflict_nota.md")).toBe(false);
    expect(hasConflictSuffix("a_conflict_2026-08-09.md")).toBe(false);
  });

  it("reconoce el nombre que produce conflictName", () => {
    expect(hasConflictSuffix(conflictName("nota.md"))).toBe(true);
  });
});
