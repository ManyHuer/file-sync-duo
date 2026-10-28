import { describe, expect, it } from "vitest";
import {
  IDLE,
  actionLabel,
  blockAction,
  canRun,
  failAction,
  isBusy,
  startAction,
  succeedAction,
  summarizeSync,
} from "../src/action";
import type { SyncSummary } from "../src/types";

const summary: SyncSummary = {
  uploaded: ["a.md", "b.md"],
  downloaded: ["c.md"],
  conflicts: ["d.md"],
  skipped: ["e.md"],
};

describe("ActionState", () => {
  it("construye cada estado", () => {
    expect(startAction()).toEqual({ status: "loading" });
    expect(succeedAction("ok")).toEqual({ status: "success", message: "ok" });
    expect(failAction("boom")).toEqual({ status: "error", message: "boom" });
    expect(blockAction("falta config")).toEqual({ status: "blocked", message: "falta config" });
    expect(IDLE).toEqual({ status: "idle" });
  });

  it("solo bloquea la ejecución en loading o blocked", () => {
    expect(canRun(IDLE)).toBe(true);
    expect(canRun(succeedAction("ok"))).toBe(true);
    expect(canRun(failAction("boom"))).toBe(true);
    expect(canRun(startAction())).toBe(false);
    expect(canRun(blockAction("falta config"))).toBe(false);
  });

  it("isBusy solo es true en loading", () => {
    expect(isBusy(startAction())).toBe(true);
    expect(isBusy(IDLE)).toBe(false);
    expect(isBusy(failAction("boom"))).toBe(false);
  });

  it("cambia la etiqueta mientras carga", () => {
    expect(actionLabel(IDLE, "Subir", "Subiendo...")).toBe("Subir");
    expect(actionLabel(startAction(), "Subir", "Subiendo...")).toBe("Subiendo...");
    expect(actionLabel(failAction("x"), "Subir", "Subiendo...")).toBe("Subir");
  });
});

describe("summarizeSync", () => {
  it("resume una subida", () => {
    expect(summarizeSync("push", summary)).toBe(
      "Subida completada: 2 subidos, conflictos: 1, sin cambios: 1",
    );
  });

  it("resume una descarga", () => {
    expect(summarizeSync("pull", summary)).toBe(
      "Descarga completada: 1 descargados, conflictos: 1, sin cambios: 1",
    );
  });
});
