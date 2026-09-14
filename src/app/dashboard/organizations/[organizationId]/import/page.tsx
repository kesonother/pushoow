import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import type { ImportKind } from "@/domain/import/types";
import { IMPORT_KINDS } from "@/domain/import/types";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { Card } from "@/ui/card";
import { ImportWizard } from "@/ui/import-wizard";
import { SiteHeader } from "@/ui/site-header";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ kind?: string; calendarId?: string; eventId?: string }>;
};

export default async function OrganizationImportPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { organizationId } = await params;
  const query = await searchParams;
  const { t } = await getI18n();
  const services = getServices();
  let calendars: Array<{ id: string; name: string }> = [];
  const events: Array<{ id: string; title: string; calendarId: string }> = [];

  try {
    const actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    calendars = (await services.calendars.listCalendars(actor)).map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
    }));
    for (const calendar of calendars) {
      const items = await services.events.listEvents(actor, calendar.id);
      events.push(...items.map((event) => ({ id: event.id, title: event.title, calendarId: event.calendarId })));
    }
  } catch (error) {
    if (error instanceof DomainError) redirect("/dashboard");
    throw error;
  }

  const kind = IMPORT_KINDS.includes(query.kind as ImportKind) ? (query.kind as ImportKind) : undefined;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
        <Link href={`/dashboard/organizations/${organizationId}/calendars`} className="text-sm underline">
          {t.dashboard.calendars}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{t.import.title}</h1>
        <Card>
          <ImportWizard
            organizationId={organizationId}
            calendars={calendars}
            events={events}
            initialKind={kind}
            initialCalendarId={query.calendarId}
            initialEventId={query.eventId}
            labels={t.import}
          />
        </Card>
      </main>
    </div>
  );
}
