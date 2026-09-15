import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { Card } from "@/ui/card";
import { CreateCalendarForm } from "@/ui/create-calendar-form";
import { EmptyState } from "@/ui/empty-state";
import { OnboardingChecklist } from "@/ui/onboarding-checklist";
import { SiteHeader } from "@/ui/site-header";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationCalendarsPage({
  params,
  searchParams,
}: PageProps & { searchParams: Promise<{ template?: string }> }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { organizationId } = await params;
  const query = await searchParams;
  const { t } = await getI18n();
  const services = getServices();
  let calendars: Awaited<ReturnType<typeof services.calendars.listCalendars>> = [];
  let onboarding;

  try {
    const actor = await requireFullDashboardActor(services.access, session.user.id, organizationId);
    calendars = await services.calendars.listCalendars(actor);
    onboarding = await services.onboarding.organizerProgress({
      userId: session.user.id,
      organizationId,
    });
  } catch (error) {
    if (error instanceof DomainError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.dashboard.calendars}</h1>
          <Link href={`/dashboard/organizations/${organizationId}/import`} className="inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70">
            {t.dashboard.importCsv}
          </Link>
        </div>
        {onboarding ? <OnboardingChecklist title={t.onboarding.titleOrganizer} progress={onboarding} t={t} /> : null}
        <CreateCalendarForm
          organizationId={organizationId}
          defaultTemplate={query.template === "meetup" || calendars.length === 0}
          labels={{
            create: t.dashboard.createCalendar,
            name: t.dashboard.calendarName,
            meetupTemplate: t.onboarding.meetupTemplate,
          }}
        />
        {calendars.length === 0 ? (
          <EmptyState
            title={t.emptyState.calendars}
            actionHref={`/dashboard/organizations/${organizationId}/calendars?template=meetup`}
            actionLabel={t.emptyState.createCalendar}
          />
        ) : null}
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
