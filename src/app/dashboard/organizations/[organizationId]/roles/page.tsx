import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { CustomRoleForm } from "@/ui/custom-role-form";
import { OrgNav } from "@/ui/org-nav";
import { SiteHeader } from "@/ui/site-header";

export default async function OrganizationRolesPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let roles;
  let actor;
  try {
    actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    roles = await services.customRoles.list(actor);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.dashboard.roles}</h1>
        <OrgNav organizationId={organizationId} actor={actor} labels={t.dashboard} />
        <Card>
          <CustomRoleForm organizationId={organizationId} labels={t.dashboard} />
        </Card>
        <ul className="flex flex-col gap-3">
          {roles.map((role) => (
            <li key={role.id}>
              <Card>
                <p className="font-medium">{role.name}</p>
                <p className="text-sm text-zinc-600">{role.grants.join(", ")}</p>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
