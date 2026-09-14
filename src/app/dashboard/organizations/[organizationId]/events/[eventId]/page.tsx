import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { getServices } from "@/server/container";
import { EventDashboardView } from "@/ui/event-dashboard";
import { SiteHeader } from "@/ui/site-header";

export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ organizationId: string; eventId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId, eventId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let dashboard;
  try {
    const actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    dashboard = await services.analytics.eventDashboard(actor, eventId);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        <Link href={`/dashboard/organizations/${organizationId}`} className="text-sm underline">
          {t.dashboard.insights}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{dashboard.title}</h1>
          <Link
            href={`/dashboard/organizations/${organizationId}/import?eventId=${eventId}&kind=guests`}
            className="text-sm underline"
          >
            {t.dashboard.importCsv}
          </Link>
        </div>
        <EventDashboardView dashboard={dashboard} labels={t.dashboard} />
      </main>
    </div>
  );
}
