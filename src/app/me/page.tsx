import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { OnboardingChecklist } from "@/ui/onboarding-checklist";
import { SiteHeader } from "@/ui/site-header";

export default async function AttendeeHomePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/me");
  const { t } = await getI18n();
  const services = getServices();
  const home = await services.analytics.attendeeHome(session.user.id, session.user.email);
  const attendee = await services.onboarding.attendeeProgress(session.user.id);

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.me.title}</h1>
        <OnboardingChecklist title={t.onboarding.titleAttendee} progress={attendee} t={t} />
        <nav className="flex flex-wrap gap-1 text-sm">
          <Link href="/me/events" className="inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-zinc-600 hover:bg-[#FAFAFA] hover:text-[#111111]">
            {t.me.events}
          </Link>
          <Link href="/me/calendars" className="inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-zinc-600 hover:bg-[#FAFAFA] hover:text-[#111111]">
            {t.me.calendars}
          </Link>
          <Link href="/me/tickets" className="inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-zinc-600 hover:bg-[#FAFAFA] hover:text-[#111111]">
            {t.me.tickets}
          </Link>
          <Link href="/profile" className="inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-zinc-600 hover:bg-[#FAFAFA] hover:text-[#111111]">
            {t.me.notifications}
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-zinc-600 hover:bg-[#FAFAFA] hover:text-[#111111]">
            {t.me.privacy}
          </Link>
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
