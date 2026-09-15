import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { ArrowRightIcon } from "@/ui/home/icons";

const primaryCtaClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[#111111] px-5 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,.12)] transition hover:-translate-y-px hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

const ghostLinkClass =
  "inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

export function Hero({ t, signedIn }: { t: Dictionary; signedIn: boolean }) {
  const copy = t.homeLanding;
  const createHref = signedIn ? "/dashboard" : "/register";

  return (
    <section className="mx-auto flex max-w-[420px] flex-col items-center px-2 pt-8 text-center sm:pt-[30px]">
      <h1 className="text-[40px] font-extrabold leading-[0.92] tracking-tight text-[#111111] sm:text-[54px]">
        <span className="block">{copy.heroLine1}</span>
        <span className="block">{copy.heroLine2}</span>
        <span className="home-gradient-text mt-1 block">{copy.heroGradient}</span>
      </h1>
      <p className="mt-5 max-w-[340px] text-[13px] leading-[1.45] text-zinc-600">{copy.heroBody}</p>
      <div className="mt-6 flex flex-col items-center gap-1">
        <Link href={createHref} className={primaryCtaClass}>
          {copy.ctaCreate}
        </Link>
        <Link href="/discover" className={ghostLinkClass}>
          {copy.ctaDiscoverArrow}
          <ArrowRightIcon className="h-3.5 w-3.5 rtl-flip" />
        </Link>
      </div>
    </section>
  );
}
