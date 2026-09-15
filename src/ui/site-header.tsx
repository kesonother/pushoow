import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { SparkleIcon } from "@/ui/home/icons";
import { LocaleSwitcher } from "@/ui/locale-switcher";
import { LogoutButton } from "@/ui/logout-button";
import { mutedPillClass, navLinkClass, primaryPillClass } from "@/ui/theme";

export function SiteHeader({
  t,
  signedIn,
}: {
  t: Dictionary;
  signedIn: boolean;
}) {
  return (
    <header className="border-b border-[#E8E8E8] bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium tracking-tight text-zinc-500"
        >
          <SparkleIcon className="h-3.5 w-3.5 text-zinc-400" />
          {t.brand}
        </Link>
        <nav aria-label={t.common.navMain} className="flex min-w-0 flex-wrap items-center justify-end gap-1 text-[13px]">
          <LocaleSwitcher />
          <Link className={navLinkClass} href="/discover">
            {t.nav.discover}
          </Link>
          <Link className={navLinkClass} href="/calendars">
            {t.nav.calendars}
          </Link>
          <Link className={navLinkClass} href="/status">
            {t.nav.status}
          </Link>
          {signedIn ? (
            <>
              <Link className={navLinkClass} href="/me">
                {t.nav.me}
              </Link>
              <Link className={navLinkClass} href="/dashboard">
                {t.nav.dashboard}
              </Link>
              <Link className={navLinkClass} href="/check-in">
                {t.nav.checkin}
              </Link>
              <Link className={navLinkClass} href="/profile">
                {t.nav.profile}
              </Link>
              <LogoutButton label={t.nav.logout} />
            </>
          ) : (
            <>
              <Link href="/login" className={mutedPillClass}>
                {t.nav.login}
              </Link>
              <Link href="/register" className={primaryPillClass}>
                {t.nav.register}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
