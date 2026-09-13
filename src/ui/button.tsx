import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-zinc-950 text-white hover:bg-zinc-800 focus-visible:outline-zinc-950 disabled:bg-zinc-400",
  secondary:
    "border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-50 focus-visible:outline-zinc-950",
  ghost: "text-zinc-950 hover:bg-zinc-100 focus-visible:outline-zinc-950",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
