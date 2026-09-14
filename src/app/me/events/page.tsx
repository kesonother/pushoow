import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

export default async function MyEventsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/me/events");
  const { t } = await getI18n();
  const home = await getServices().analytics.attendeeHome(session.user.id, session.user.email);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <Link href="/me" className="text-sm underline">
          {t.me.title}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{t.me.events}</h1>
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
