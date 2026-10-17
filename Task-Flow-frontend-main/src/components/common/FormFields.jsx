import React from "react";

export function FormField({ label, hint, children, className = "", required, style }) {
  return (
    <div className={`form-group ${className}`.trim()} style={style}>
      {label ? (
        <label>
          {typeof label === 'string' && required ? label.replace(/\s*\*+\s*$/, '') : label}{" "}
          {required && <span style={{ color: 'var(--danger-color)' }}>*</span>}
        </label>
      ) : null}
      {children}
      {hint ? <small style={{ display: 'block', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>{hint}</small> : null}
    </div>
  );
}

export function TextInput({ label, hint, className = "", inputClassName = "", required, style, ...props }) {
  return (
    <FormField label={label} hint={hint} className={className} required={required} style={style}>
      <input className={`form-control ${inputClassName}`.trim()} required={required} {...props} />
    </FormField>
  );
}

export function TextAreaField({ label, hint, className = "", inputClassName = "", ...props }) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <textarea className={`form-control ${inputClassName}`.trim()} style={{ height: '100px', resize: 'none' }} {...props} />
    </FormField>
  );
}

export function SelectField({ label, hint, className = "", selectClassName = "", options, children, required, style, ...props }) {
  return (
    <FormField label={label} hint={hint} className={className} required={required} style={style}>
      <select className={`form-control ${selectClassName}`.trim()} style={{ appearance: 'auto' }} required={required} {...props} >
        {options ? options.map((opt) => (
            <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
          )) : children}
      </select>
    </FormField>
  );
}
