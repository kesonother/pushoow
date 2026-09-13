import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getI18n } from "@/i18n/server";
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
  const organizations = await services.organizations.listOrganizationsForUser(
    session.user.id,
  );

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.dashboard.title}</h1>
        <CreateOrganizationForm labels={{ create: t.dashboard.create, name: t.dashboard.name }} />
        {organizations.length === 0 ? (
          <p className="text-zinc-600">{t.dashboard.empty}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Card>
                  <h2 className="text-lg font-medium">{organization.name}</h2>
                  <p className="mt-1 text-sm text-zinc-600">{organization.slug}</p>
                  <div className="mt-3 flex gap-3 text-sm underline">
                    <Link href={`/dashboard/organizations/${organization.id}/calendars`}>
                      {t.dashboard.calendars}
                    </Link>
                    <Link href={`/dashboard/organizations/${organization.id}/members`}>
                      Members
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
