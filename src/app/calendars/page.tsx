import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { FeaturedCalendars } from "@/ui/featured-calendars";
import { SiteHeader } from "@/ui/site-header";

export default async function FeaturedCalendarsPage() {
  const { t } = await getI18n();
  const session = await getSession();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={Boolean(session?.user)} />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <header className="grid gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.discover.featuredTitle}</h1>
          <p className="text-zinc-600">{t.discover.featuredBody}</p>
        </header>
        <FeaturedCalendars labels={t.discover} />
      </main>
    </div>
  );
}
