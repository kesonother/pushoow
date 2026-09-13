import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { LogoutButton } from "@/ui/logout-button";

export function SiteHeader({
  t,
  signedIn,
}: {
  t: Dictionary;
  signedIn: boolean;
}) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-950">
          {t.brand}
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-3 text-sm">
          <Link className="rounded-md px-2 py-1 hover:bg-zinc-100" href="/discover">
            {t.nav.discover}
          </Link>
          <Link className="rounded-md px-2 py-1 hover:bg-zinc-100" href="/calendars">
            {t.nav.calendars}
          </Link>
          {signedIn ? (
            <>
              <Link className="rounded-md px-2 py-1 hover:bg-zinc-100" href="/dashboard">
                {t.nav.dashboard}
              </Link>
              <Link className="rounded-md px-2 py-1 hover:bg-zinc-100" href="/profile">
                {t.nav.profile}
              </Link>
              <LogoutButton label={t.nav.logout} />
            </>
          ) : (
            <>
              <Link className="rounded-md px-2 py-1 hover:bg-zinc-100" href="/login">
                {t.nav.login}
              </Link>
              <Link
                className="rounded-lg bg-zinc-950 px-3 py-2 font-medium text-white hover:bg-zinc-800"
                href="/register"
              >
                {t.nav.register}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
