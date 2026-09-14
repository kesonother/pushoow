import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { getServices } from "@/server/container";
import { OrganizerDashboardView } from "@/ui/organizer-dashboard";
import { OrgNav } from "@/ui/org-nav";
import { SiteHeader } from "@/ui/site-header";

export default async function OrganizationDashboardPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let dashboard;
  let advanced;
  let actor;
  try {
    actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    dashboard = await services.analytics.organizerDashboard(actor);
    advanced = await services.analytics.advanced(actor);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        <Link href="/dashboard" className="text-sm underline">
          {t.dashboard.title}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{t.dashboard.insights}</h1>
        </div>
        <OrgNav organizationId={organizationId} actor={actor} labels={t.dashboard} />
        <OrganizerDashboardView
          organizationId={organizationId}
          dashboard={dashboard}
          advanced={advanced}
          labels={t.dashboard}
        />
      </main>
    </div>
  );
}
