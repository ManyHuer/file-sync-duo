import { actionLabel } from "@filesync/core";
import type { ActionState } from "@filesync/core";
import type { BusyAction, SyncDirection } from "../types";
import { DownloadIcon, UploadIcon } from "./icons";

interface SyncActionsCardProps {
  busy: boolean;
  busyAction: BusyAction;
  pushState: ActionState;
  pullState: ActionState;
  statusMessage: string | null;
  error: string | null;
  lastFailedSync: SyncDirection | null;
  currentFolder: string | null;
  privateFolder: boolean;
  onSync: (direction: SyncDirection) => void;
}

export function SyncActionsCard({
  busy,
  busyAction,
  pushState,
  pullState,
  statusMessage,
  error,
  lastFailedSync,
  currentFolder,
  privateFolder,
  onSync,
}: SyncActionsCardProps) {
  return (
    <section className="card" aria-busy={busy}>
      <div className="actions">
        <button className="btn primary" data-testid="btn-push" disabled={busy} onClick={() => onSync("push")}>
          {busyAction === "push" ? <span className="spinner" aria-hidden="true" /> : <UploadIcon />}
          {actionLabel(pushState, "Subir a GitHub", "Subiendo...")}
        </button>
        <button className="btn primary" data-testid="btn-pull" disabled={busy} onClick={() => onSync("pull")}>
          {busyAction === "pull" ? <span className="spinner" aria-hidden="true" /> : <DownloadIcon />}
          {actionLabel(pullState, "Descargar de GitHub", "Descargando...")}
        </button>
      </div>
      {statusMessage && (
        <div className="status-banner success-banner" role="status">
          <span className="status-dot" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}
      {error && lastFailedSync && (
        <div className="status-banner error-banner" role="alert">
          <span className="status-dot" aria-hidden="true" />
          <p className="error">{error}</p>
          <button className="btn" data-testid="btn-retry" disabled={busy} onClick={() => onSync(lastFailedSync)}>
            Reintentar
          </button>
        </div>
      )}
      {currentFolder && (
        <p className="hint">Sincronizando solo la carpeta: <code>{currentFolder}</code></p>
      )}
      {privateFolder && (
        <p className="hint">Carpeta privada: se excluye de la sincronización.</p>
      )}
    </section>
  );
}
