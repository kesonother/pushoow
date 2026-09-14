import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

export default async function AttendeeHomePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/me");
  const { t } = await getI18n();
  const home = await getServices().analytics.attendeeHome(session.user.id, session.user.email);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.me.title}</h1>
        <nav className="flex flex-wrap gap-3 text-sm underline">
          <Link href="/me/events">{t.me.events}</Link>
          <Link href="/me/calendars">{t.me.calendars}</Link>
          <Link href="/me/tickets">{t.me.tickets}</Link>
          <Link href="/profile">{t.me.notifications}</Link>
          <Link href="/privacy">{t.me.privacy}</Link>
        </nav>
        <Card>
          <p className="text-sm text-zinc-600">
            {home.events.length} {t.me.events} · {home.calendars.length} {t.me.calendars} · {home.tickets.length}{" "}
            {t.me.tickets}
          </p>
        </Card>
      </main>
    </div>
  );
}
