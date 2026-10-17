import React from "react";

export default function FormModal({
  show,
  onClose,
  title,
  children,
  onSave,
  saveText = "Save",
  saveColor,
  cancelText = "Cancel",
  maxWidth = "500px",
  loading = false,
}) {
  React.useEffect(() => {
    if (show) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [show]);

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth }}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>

        <div className="modal-body" style={{ overflow: 'visible' }}>
          {children}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={loading}
            style={saveColor ? { background: saveColor, border: 'none' } : {}}
          >
            {loading ? "Saving..." : saveText}
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
