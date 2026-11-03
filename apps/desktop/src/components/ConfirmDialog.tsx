import type { ReactNode } from "react";

interface ConfirmDialogProps {
  ariaLabel: string;
  title: string;
  description: ReactNode;
  items?: string[];
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  cancelTestId?: string;
  confirmTestId?: string;
}

export function ConfirmDialog({
  ariaLabel,
  title,
  description,
  items,
  cancelLabel = "Cancelar",
  confirmLabel,
  onCancel,
  onConfirm,
  busy = false,
  cancelTestId,
  confirmTestId,
}: ConfirmDialogProps) {
  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <h3>{title}</h3>
        <p>{description}</p>
        {items && items.length > 0 && (
          <ul className="orphan-list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button className="btn" data-testid={cancelTestId} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button className="btn danger" data-testid={confirmTestId} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
