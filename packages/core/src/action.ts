import type { SyncSummary } from "./types";

export type ActionStatus = "idle" | "loading" | "success" | "error" | "blocked";

export interface ActionState {
  status: ActionStatus;
  message?: string;
}

export const IDLE: ActionState = { status: "idle" };

export function startAction(): ActionState {
  return { status: "loading" };
}

export function succeedAction(message: string): ActionState {
  return { status: "success", message };
}

export function failAction(message: string): ActionState {
  return { status: "error", message };
}

export function blockAction(message: string): ActionState {
  return { status: "blocked", message };
}

export function isBusy(state: ActionState): boolean {
  return state.status === "loading";
}

export function canRun(state: ActionState): boolean {
  return state.status !== "loading" && state.status !== "blocked";
}

export function actionLabel(
  state: ActionState,
  idleLabel: string,
  loadingLabel: string,
): string {
  return state.status === "loading" ? loadingLabel : idleLabel;
}

export function summarizeSync(direction: "push" | "pull", summary: SyncSummary): string {
  const conflicts = summary.conflicts.length;
  const skipped = summary.skipped.length;

  if (direction === "push") {
    return `Subida completada: ${summary.uploaded.length} subidos, conflictos: ${conflicts}, sin cambios: ${skipped}`;
  }

  return `Descarga completada: ${summary.downloaded.length} descargados, conflictos: ${conflicts}, sin cambios: ${skipped}`;
}
