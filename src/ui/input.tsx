import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Input({ label, hint, id, className = "", ...props }: InputProps) {
  const inputId = id ?? props.name;
  const hintId = hint && inputId ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-zinc-900">
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={hintId}
        className={`min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none focus-visible:border-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-950/20 ${className}`}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-zinc-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
