// ConfirmModal.tsx — two-button confirmation overlay (Cancel + Confirm)
//
// Used for destructive actions that cannot be undone (e.g. deleting a saved run).
// Rendered at App level so it floats above all page content.
// Props:
//   title       — short label in the header (e.g. "Delete Run")
//   message     — explanation of what will happen
//   confirmLabel — text on the confirm button (default "Delete")
//   onConfirm   — called when the user clicks the confirm button
//   onCancel    — called when the user clicks Cancel or the backdrop

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="error-modal-backdrop" onClick={onCancel}>
      <div className="error-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <span className="confirm-modal-icon">?</span>
          <h3 className="confirm-modal-title">{title}</h3>
        </div>
        <p className="error-modal-message">{message}</p>
        <div className="confirm-modal-footer">
          <button className="confirm-modal-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-modal-confirm-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
