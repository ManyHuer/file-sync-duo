import { describe, expect, it } from "vitest";
import { filterPrivate, isPrivatePath } from "../src/private";

describe("isPrivatePath", () => {
  it("marca la carpeta y todo su subárbol", () => {
    const privadas = ["Personal", "Trabajo/Secreto"];

    expect(isPrivatePath("Personal", privadas)).toBe(true);
    expect(isPrivatePath("Personal/2026/nota.md", privadas)).toBe(true);
    expect(isPrivatePath("Trabajo/Secreto/nota.md", privadas)).toBe(true);
  });

  it("no marca prefijos parciales ni rutas fuera de la carpeta", () => {
    const privadas = ["Personal"];

    expect(isPrivatePath("Personal2/nota.md", privadas)).toBe(false);
    expect(isPrivatePath("Otra/nota.md", privadas)).toBe(false);
    expect(isPrivatePath("nota.md", privadas)).toBe(false);
  });

  it("normaliza barras al inicio y al final", () => {
    expect(isPrivatePath("Personal/nota.md", ["/Personal/"])).toBe(true);
    expect(isPrivatePath("nota.md", ["/"])).toBe(false);
  });

  it("filterPrivate quita archivos del subárbol", () => {
    const files = [{ name: "publico.md" }, { name: "Personal/nota.md" }, { name: "Personal2/nota.md" }];

    expect(filterPrivate(files, ["Personal"]).map((f) => f.name)).toEqual([
      "publico.md",
      "Personal2/nota.md",
    ]);
  });
});
