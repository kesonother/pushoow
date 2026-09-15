import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";

const outlineCta =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[#E8E8E8] bg-white px-4 text-[13px] font-medium text-[#171717] transition-colors hover:border-zinc-300 hover:bg-[#FAFAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

const mutedCta =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-100 px-4 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

export function BottomCTA({ t, signedIn }: { t: Dictionary; signedIn: boolean }) {
  const copy = t.homeLanding;
  return (
    <section className="mx-auto mt-20 max-w-[420px] px-2 pb-4 pt-8 text-center sm:mt-24">
      <p className="home-gradient-text text-[28px] font-extrabold leading-[1.05] tracking-tight sm:text-[34px]">
        <span className="block">{copy.bottomLine1}</span>
        <span className="block">{copy.bottomLine2}</span>
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link href="/discover" className={outlineCta}>
          {copy.ctaDiscover}
        </Link>
        <Link href={signedIn ? "/dashboard" : "/register"} className={mutedCta}>
          {copy.ctaCalendar}
        </Link>
      </div>
    </section>
  );
}
