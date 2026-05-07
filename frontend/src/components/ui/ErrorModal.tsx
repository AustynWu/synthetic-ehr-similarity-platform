// ErrorModal.tsx — full-screen overlay for network and evaluation errors
//
// Rendered at App level so it floats above all page content.
// Props:
//   title   — short label shown in the red header (e.g. "Upload Failed")
//   message — full error text from the caught exception
//   onClose — called when the user clicks the close button or the backdrop

interface ErrorModalProps {
  title: string;
  message: string;
  onClose: () => void;
}

export default function ErrorModal({ title, message, onClose }: ErrorModalProps) {
  return (
    // Clicking the backdrop (outside the card) also closes the modal
    <div className="error-modal-backdrop" onClick={onClose}>
      {/* stopPropagation prevents clicks inside the card from closing it */}
      <div className="error-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="error-modal-header">
          <span className="error-modal-icon">!</span>
          <h3 className="error-modal-title">{title}</h3>
        </div>
        <p className="error-modal-message">{message}</p>
        <div className="error-modal-footer">
          <button className="error-modal-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
