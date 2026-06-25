import type { ReactNode } from 'react';

export function Field({
  label, required, hint, error, children, full,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label">
        {label}{required && <span className="required">*</span>}
      </label>
      {children}
      {hint && !error && <div className="form-hint">{hint}</div>}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function Select({
  value, onChange, options, placeholder, error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  error?: boolean;
}) {
  return (
    <select className={`form-control${error ? ' error' : ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
