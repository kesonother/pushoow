import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "muted";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[#111111] text-white shadow-[0_2px_8px_rgba(0,0,0,.12)] hover:-translate-y-px hover:bg-black focus-visible:outline-zinc-950 disabled:bg-zinc-600 disabled:text-white disabled:shadow-none disabled:hover:translate-y-0",
  secondary:
    "border border-[#E8E8E8] bg-white text-[#171717] hover:border-zinc-300 hover:bg-[#FAFAFA] focus-visible:outline-zinc-950 disabled:border-zinc-400 disabled:text-zinc-600",
  ghost: "text-zinc-600 hover:bg-[#FAFAFA] hover:text-[#111111] focus-visible:outline-zinc-950 disabled:text-zinc-600",
  muted:
    "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 focus-visible:outline-zinc-950 disabled:bg-zinc-100 disabled:text-zinc-600",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
