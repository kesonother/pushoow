import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { AgencyClientForm } from "@/ui/agency-client-form";
import { Card } from "@/ui/card";
import { OrgNav } from "@/ui/org-nav";
import { SiteHeader } from "@/ui/site-header";

export default async function OrganizationAgencyPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let actor;
  let organization;
  let clients: Awaited<ReturnType<typeof services.agency.listClients>> = [];
  try {
    actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    organization = await services.organizations.getOrganization(actor);
    if (organization.kind === "agency") {
      clients = await services.agency.listClients(actor);
    }
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.dashboard.agency}</h1>
        <OrgNav organizationId={organizationId} actor={actor} labels={t.dashboard} />
        <AgencyClientForm
          organizationId={organizationId}
          labels={{
            createClient: t.dashboard.createClient,
            name: t.dashboard.name,
            convertAgency: t.dashboard.convertAgency,
            isAgency: organization.kind === "agency",
          }}
        />
        {clients.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {clients.map((client) => (
              <li key={client.id}>
                <Card>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm text-zinc-600">{client.slug}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm underline">
                    <Link href={`/dashboard/organizations/${client.id}`}>{t.dashboard.insights}</Link>
                    <Link href={`/dashboard/organizations/${client.id}/settings`}>{t.dashboard.settings}</Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
