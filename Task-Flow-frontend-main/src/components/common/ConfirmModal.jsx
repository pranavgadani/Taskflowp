import React from "react";
import FormModal from "./FormModal";

export default function ConfirmModal({
    show,
    onClose,
    onConfirm,
    title = "Confirmation",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    confirmColor = "var(--danger-color)",
    cancelText = "Cancel"
}) {
    return (
        <FormModal
            show={show}
            onClose={onClose}
            onSave={onConfirm}
            title={title}
            saveText={confirmText}
            saveColor={confirmColor}
            cancelText={cancelText}
            maxWidth="400px"
        >
            <div style={{ textAlign: "center", padding: "10px 0" }}>
                <p style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: "600", marginBottom: "10px" }}>
                    {message}
                </p>
                <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                    This action cannot be undone.
                </p>
            </div>
        </FormModal>
    );
}
