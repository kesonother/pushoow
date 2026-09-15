import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { SparkleIcon } from "@/ui/home/icons";

const loginClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

export function Header({
  t,
  signedIn,
}: {
  t: Dictionary;
  signedIn: boolean;
}) {
  return (
    <header className="relative flex items-center justify-between px-6 pt-5">
      <span className="inline-flex min-h-11 min-w-11 items-center justify-start text-zinc-400" aria-hidden="true">
        <SparkleIcon className="h-4 w-4" />
      </span>
      <Link
        href="/"
        className="absolute left-1/2 top-5 -translate-x-1/2 text-[13px] font-medium tracking-tight text-zinc-500"
      >
        {t.brand}
      </Link>
      {signedIn ? (
        <Link href="/dashboard" className={loginClassName}>
          {t.nav.dashboard}
        </Link>
      ) : (
        <Link href="/login" className={loginClassName}>
          {t.home.ctaLogin}
        </Link>
      )}
    </header>
  );
}
