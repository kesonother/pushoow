import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { OrgNav } from "@/ui/org-nav";
import { OrganizationSettingsForm } from "@/ui/organization-settings-form";
import { SiteHeader } from "@/ui/site-header";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let organization;
  let actor;
  let usage;
  let domains;
  try {
    actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    organization = await services.organizations.getOrganization(actor);
    usage = await services.organizations.calendarUsage(organization.id);
    domains = await services.domains.listDomains(actor);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.dashboard.settings}</h1>
        <OrgNav organizationId={organizationId} actor={actor} labels={t.dashboard} />
        <p className="text-sm text-zinc-600">
          {t.dashboard.calendarQuota}: {usage.used}/{usage.limit}
          {actor.viaAgency ? ` · ${t.dashboard.viaAgency}` : ""}
        </p>
        <Card>
          <OrganizationSettingsForm organization={organization} labels={t.dashboard} />
        </Card>
        {domains.length > 0 ? (
          <ul className="flex flex-col gap-2 text-sm">
            {domains.map((domain) => (
              <li key={domain.id}>
                {domain.domain} · {domain.kind}
                {domain.verifiedAt ? " · verified" : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
