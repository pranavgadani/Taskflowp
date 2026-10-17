import React from "react";

export default function PageHeader({ 
  title, 
  buttonText, 
  onButtonClick, 
  secondaryButtonText, 
  onSecondaryButtonClick,
  children 
}) {
  return (
    <div className="header">
      <h2>{title}</h2>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {secondaryButtonText && onSecondaryButtonClick && (
          <button className="btn btn-secondary" onClick={onSecondaryButtonClick}>
            {secondaryButtonText}
          </button>
        )}
        {children}
        {buttonText && onButtonClick && (
          <button className="btn btn-primary" onClick={onButtonClick}>
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
}
