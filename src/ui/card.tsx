import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#E8E8E8] bg-white p-5 transition-colors hover:border-zinc-300 ${className}`}
    >
      {children}
    </div>
  );
}
