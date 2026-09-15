"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { controlClassName } from "@/ui/control";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
};

export function SelectField({ label, hint, id, className = "", children, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? (typeof props.name === "string" ? props.name : generatedId);
  const hintId = hint ? `${selectId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-zinc-900">
        {label}
      </label>
      <select id={selectId} aria-describedby={hintId} className={`${controlClassName} ${className}`} {...props}>
        {children}
      </select>
      {hint ? (
        <p id={hintId} className="text-sm text-zinc-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
