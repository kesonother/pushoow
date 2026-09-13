import Link from "next/link";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { SiteHeader } from "@/ui/site-header";

export default async function HomePage() {
  const { t } = await getI18n();
  const session = await getSession();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={Boolean(session?.user)} />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          {t.tagline}
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
          {t.home.title}
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-600">{t.home.body}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/discover"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t.home.ctaDiscover}
          </Link>
          <Link
            href={session?.user ? "/dashboard" : "/register"}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-5 text-sm font-medium text-zinc-950 hover:bg-zinc-50"
          >
            {t.home.ctaRegister}
          </Link>
          {!session?.user ? (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-5 text-sm font-medium text-zinc-950 hover:bg-zinc-50"
            >
              {t.home.ctaLogin}
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
