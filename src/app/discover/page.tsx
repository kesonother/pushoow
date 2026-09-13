import { Suspense } from "react";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { DiscoverExplorer } from "@/ui/discover-explorer";
import { SiteHeader } from "@/ui/site-header";

export default async function DiscoverPage() {
  const { t } = await getI18n();
  const session = await getSession();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={Boolean(session?.user)} />
      <main id="content" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
        <header className="grid gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.discover.title}</h1>
          <p className="max-w-2xl text-zinc-600">{t.discover.body}</p>
        </header>
        <Suspense fallback={<p>…</p>}>
          <DiscoverExplorer labels={t.discover} />
        </Suspense>
      </main>
    </div>
  );
}
