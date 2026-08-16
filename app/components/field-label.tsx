import React, { type ReactNode } from "react";

type FieldLabelProps = {
  label: string;
  help: string;
  children: ReactNode;
  className?: string;
};

export function FieldLabel({
  label,
  help,
  children,
  className = "",
}: FieldLabelProps) {
  return (
    <label className={`text-xs font-medium text-slate-600 ${className}`}>
      <span className="mb-1 flex items-center gap-1.5">
        <span>{label}</span>
        <span
          tabIndex={0}
          role="img"
          aria-label={`Informação sobre ${label}: ${help}`}
          title={help}
          className="inline-grid h-4 w-4 cursor-help place-items-center rounded-full border border-sky-300 bg-sky-50 text-[10px] font-bold text-sky-700"
        >
          i
        </span>
      </span>
      {children}
    </label>
  );
}
