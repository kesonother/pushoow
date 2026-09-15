import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { SiteHeader } from "@/ui/site-header";

const widths = {
  narrow: "max-w-md",
  content: "max-w-3xl",
  wide: "max-w-5xl",
  xl: "max-w-6xl",
} as const;

export function PageShell({
  t,
  signedIn,
  width = "wide",
  children,
  className = "",
}: {
  t: Dictionary;
  signedIn: boolean;
  width?: keyof typeof widths;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn={signedIn} />
      <main
        id="content"
        className={`mx-auto flex w-full ${widths[width]} flex-1 flex-col gap-6 px-6 py-10 ${className}`}
      >
        {children}
      </main>
    </div>
  );
}
