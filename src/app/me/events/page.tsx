import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { SiteHeader } from "@/ui/site-header";

export default async function MyEventsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/me/events");
  const { t } = await getI18n();
  const home = await getServices().analytics.attendeeHome(session.user.id, session.user.email);

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <Link href="/me" className="inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70">
          {t.me.title}
        </Link>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.me.events}</h1>
        {home.events.length === 0 ? (
          <EmptyState
            title={t.emptyState.meEvents}
            actionHref="/discover"
            actionLabel={t.emptyState.discoverEvents}
          />
        ) : null}
        <ul className="grid gap-3">
          {home.events.map((event) => (
            <li key={event.registrationId}>
              <Card>
                <Link className="text-lg font-medium underline" href={`/e/${event.slug}`}>
                  {event.title}
                </Link>
                <p className="text-sm text-zinc-600">
                  {event.startsAt} · {event.status}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
