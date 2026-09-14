import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { canAccessFullDashboard } from "@/domain/rbac/dashboard";
import { hasPermission } from "@/domain/rbac/permissions";
import { getI18n } from "@/i18n/server";
import { staffCanCreateOrganizations } from "@/server/dashboard-access";
import { getServices } from "@/server/container";
import Link from "next/link";
import { Card } from "@/ui/card";
import { CreateOrganizationForm } from "@/ui/create-organization-form";
import { SiteHeader } from "@/ui/site-header";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const { t } = await getI18n();
  const services = getServices();
  const accessible = await services.access.listAccessible(
    session.user.id,
    Boolean(session.user.emailVerified),
  );
  const canCreate = staffCanCreateOrganizations(
    accessible.filter((item) => !item.actor.viaAgency).map((item) => item.actor.role),
  );

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.dashboard.title}</h1>
        {canCreate ? (
          <CreateOrganizationForm labels={{ create: t.dashboard.create, name: t.dashboard.name }} />
        ) : (
          <p className="text-sm text-zinc-600">{t.dashboard.checkinOnly}</p>
        )}
        {accessible.length === 0 ? (
          <p className="text-zinc-600">{t.dashboard.empty}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {accessible.map(({ organization, actor }) => {
              const full = canAccessFullDashboard(actor);
              const door = hasPermission(actor, "checkin:manage");
              return (
                <li key={organization.id}>
                  <Card>
                    <h2 className="text-lg font-medium">{organization.name}</h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      {organization.slug}
                      {actor.viaAgency ? ` · ${t.dashboard.viaAgency}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm underline">
                      {full ? (
                        <>
                          <Link href={`/dashboard/organizations/${organization.id}`}>
                            {t.dashboard.insights}
                          </Link>
                          <Link href={`/dashboard/organizations/${organization.id}/calendars`}>
                            {t.dashboard.calendars}
                          </Link>
                          <Link href={`/dashboard/organizations/${organization.id}/members`}>
                            {t.dashboard.members}
                          </Link>
                          <Link href={`/dashboard/organizations/${organization.id}/settings`}>
                            {t.dashboard.settings}
                          </Link>
                          <Link href={`/dashboard/organizations/${organization.id}/payments`}>
                            {t.dashboard.payments}
                          </Link>
                        </>
                      ) : null}
                      {door ? <Link href="/check-in">{t.nav.checkin}</Link> : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
