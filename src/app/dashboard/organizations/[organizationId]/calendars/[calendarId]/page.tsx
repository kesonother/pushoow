import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveCalendarActor } from "@/api/authorize";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import type { Calendar } from "@/domain/calendar/types";
import type { OrganizerInsights } from "@/domain/discovery/types";
import type { Event } from "@/domain/event/types";
import type { CalendarMember, CalendarMembershipTier } from "@/domain/calendar/membership-types";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { CalendarInsights } from "@/ui/calendar-insights";
import { Card } from "@/ui/card";
import { EditCalendarForm } from "@/ui/edit-calendar-form";
import { SiteHeader } from "@/ui/site-header";

type PageProps = {
  params: Promise<{ organizationId: string; calendarId: string }>;
};

export default async function EditCalendarPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { organizationId, calendarId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let calendar: Calendar;
  let members: CalendarMember[];
  let tiers: CalendarMembershipTier[];
  let events: Event[] = [];
  let insights: OrganizerInsights | null = null;

  try {
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      session.user.id,
      calendarId,
    );
    if (actor.organizationId !== organizationId) redirect("/dashboard");
    calendar = await services.calendars.getCalendar(actor, calendarId);
    members = await services.calendarMemberships.listMembers(actor, calendarId);
    tiers = await services.calendarMemberships.listTiers(calendarId);
    events = await services.events.listEvents(actor, calendarId);
    try {
      insights = await services.discovery.insights(calendarId);
    } catch {
      insights = null;
    }
  } catch (error) {
    if (error instanceof DomainError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <Link href={`/dashboard/organizations/${organizationId}/calendars`} className="text-sm underline">
          {t.dashboard.calendars}
        </Link>
          <h1 className="text-3xl font-semibold tracking-tight">{calendar.name}</h1>
          <Link
            href={`/dashboard/organizations/${organizationId}/calendars/${calendarId}/events/new`}
            className="text-sm underline"
          >
            {t.event.newEvent}
          </Link>
        <Card>
          <EditCalendarForm
            calendar={calendar}
            labels={{
              name: t.dashboard.calendarName,
              description: t.calendar.description,
              timezone: t.calendar.timezone,
              currency: t.calendar.currency,
              visibility: t.calendar.visibility,
              save: t.profile.save,
              delete: t.calendar.delete,
              bannedWords: t.event.bannedWords,
            }}
          />
        </Card>
        {insights ? <CalendarInsights insights={insights} labels={t.discover} /> : null}
        <Card>
          <h2 className="text-lg font-medium">{t.event.wizardTitle}</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {event.title} · {event.status}
                </span>
                <Link
                  className="underline"
                  href={`/dashboard/organizations/${organizationId}/calendars/${calendarId}/events/${event.id}/edit`}
                >
                  {t.event.editEvent}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-medium">Tiers</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {tiers.map((tier) => (
              <li key={tier.id}>
                {tier.name} · {tier.kind}
                {tier.requiresApproval ? " · approval" : ""}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-medium">Memberships</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {members.map((member) => (
              <li key={member.id}>
                {member.userId} · {member.status}
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
