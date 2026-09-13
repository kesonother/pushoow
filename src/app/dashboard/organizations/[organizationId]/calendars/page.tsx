import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { resolveActor } from "@/api/authorize";
import { Card } from "@/ui/card";
import { CreateCalendarForm } from "@/ui/create-calendar-form";
import { SiteHeader } from "@/ui/site-header";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationCalendarsPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { organizationId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let calendars;

  try {
    const actor = await resolveActor(services.memberships, session.user.id, organizationId);
    calendars = await services.calendars.listCalendars(actor);
  } catch (error) {
    if (error instanceof DomainError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.dashboard.calendars}</h1>
        <CreateCalendarForm
          organizationId={organizationId}
          labels={{ create: t.dashboard.createCalendar, name: t.dashboard.calendarName }}
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {calendars.map((calendar) => (
            <li key={calendar.id}>
              <Card>
                <h2 className="text-lg font-medium">{calendar.name}</h2>
                <p className="mt-1 text-sm text-zinc-600">{calendar.slug}</p>
                <div className="mt-3 flex gap-3 text-sm underline">
                  <Link href={`/c/${calendar.slug}`}>Public</Link>
                  <Link href={`/dashboard/organizations/${organizationId}/calendars/${calendar.id}`}>
                    {t.calendar.edit}
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
