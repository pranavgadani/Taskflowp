import React from "react";

export default function AlertModal({
  show,
  onClose,
  title = "Notice",
  message = "",
  type = "info", // "info", "warning", "error", "success"
  buttonText = "OK",
  maxWidth = "440px"
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

  const getTheme = () => {
    switch (type) {
      case "error":
        return {
          bg: "#fef2f2",
          border: "#fecaca",
          iconColor: "#dc2626",
          btnBg: "#dc2626",
          icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          )
        };
      case "warning":
        return {
          bg: "#fffbeb",
          border: "#fde68a",
          iconColor: "#d97706",
          btnBg: "#d97706",
          icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          )
        };
      case "success":
        return {
          bg: "#f0fdf4",
          border: "#bbf7d0",
          iconColor: "#16a34a",
          btnBg: "#16a34a",
          icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          )
        };
      default:
        return {
          bg: "#eff6ff",
          border: "#bfdbfe",
          iconColor: "#2563eb",
          btnBg: "#4f46e5",
          icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          )
        };
    }
  };

  const theme = getTheme();

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div 
        className="modal" 
        style={{ 
          maxWidth, 
          padding: "24px",
          borderRadius: "16px",
          textAlign: "center",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        }}
      >
        <div 
          style={{ 
            width: "56px", 
            height: "56px", 
            borderRadius: "50%", 
            background: theme.bg, 
            border: `1px solid ${theme.border}`,
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            margin: "0 auto 16px" 
          }}
        >
          {theme.icon}
        </div>

        <h3 style={{ margin: "0 0 8px", fontSize: "19px", fontWeight: "700", color: "#1e293b" }}>
          {title}
        </h3>

        <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#64748b", lineHeight: "1.6", whiteSpace: "pre-line" }}>
          {message}
        </p>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={onClose}
            style={{
              background: theme.btnBg,
              color: "#ffffff",
              border: "none",
              padding: "10px 28px",
              borderRadius: "10px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              transition: "transform 0.1s"
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
