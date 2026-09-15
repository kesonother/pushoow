import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { InstagramIcon, MailIcon, XIcon } from "@/ui/home/icons";
import { LocaleSwitcher } from "@/ui/locale-switcher";

const linkClass =
  "inline-flex min-h-11 items-center text-[12px] text-zinc-600 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

const iconLinkClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

export function Footer({ t }: { t: Dictionary }) {
  const copy = t.homeLanding;

  return (
    <footer className="mt-10 border-t border-[#E8E8E8]">
      <div className="mx-auto flex w-full max-w-[620px] flex-col gap-2 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label={t.common.navMain} className="flex min-w-0 flex-wrap items-center gap-x-3">
            <Link href="/" className={`${linkClass} font-medium`}>
              {t.brand}
            </Link>
            <Link href="/discover" className={linkClass}>
              {copy.footerDiscover}
            </Link>
            <Link href="/register" className={linkClass}>
              {copy.footerPricing}
            </Link>
            <Link href="/discover" className={linkClass}>
              {copy.footerApp}
            </Link>
            <Link href="/status" className={linkClass}>
              {copy.footerHelp}
            </Link>
          </nav>
          <ul className="flex items-center">
            <li>
              <a
                className={iconLinkClass}
                href="https://www.instagram.com/"
                rel="noreferrer"
                target="_blank"
              >
                <InstagramIcon className="h-4 w-4" title={copy.socialInstagram} />
              </a>
            </li>
            <li>
              <a className={iconLinkClass} href="https://x.com/" rel="noreferrer" target="_blank">
                <XIcon className="h-4 w-4" title={copy.socialX} />
              </a>
            </li>
            <li>
              <a className={iconLinkClass} href="mailto:press@pushoow.com">
                <MailIcon className="h-4 w-4" title={copy.socialEmail} />
              </a>
            </li>
          </ul>
        </div>
        <nav aria-label={copy.footerPrivacy} className="flex flex-wrap items-center gap-x-3">
          <Link href="/privacy" className={`${linkClass} text-[11px]`}>
            {copy.footerTerms}
          </Link>
          <Link href="/privacy" className={`${linkClass} text-[11px]`}>
            {copy.footerPrivacy}
          </Link>
          <Link href="/status" className={`${linkClass} text-[11px]`}>
            {copy.footerSecurity}
          </Link>
          <a href="mailto:press@pushoow.com" className={`${linkClass} text-[11px]`}>
            {copy.footerDmca}
          </a>
        </nav>
        <div className="pt-1">
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}
