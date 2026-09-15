import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { SiteHeader } from "@/ui/site-header";

export default async function MyCalendarsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/me/calendars");
  const { t } = await getI18n();
  const home = await getServices().analytics.attendeeHome(session.user.id, session.user.email);

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <Link href="/me" className="inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70">
          {t.me.title}
        </Link>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.me.calendars}</h1>
        {home.calendars.length === 0 ? (
          <EmptyState
            title={t.emptyState.meCalendars}
            actionHref="/discover"
            actionLabel={t.emptyState.followCalendars}
          />
        ) : null}
        <ul className="grid gap-3">
          {home.calendars.map((calendar) => (
            <li key={calendar.calendarId}>
              <Card>
                <Link className="text-lg font-medium underline" href={`/c/${calendar.slug}`}>
                  {calendar.name}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
