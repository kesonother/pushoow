import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { DomainError } from "@/domain/errors";
import { getI18n } from "@/i18n/server";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { IntegrationsPanel } from "@/ui/integrations-panel";
import { SiteHeader } from "@/ui/site-header";

export default async function OrganizationIntegrationsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let items;

  try {
    const actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    items = await services.integrations.catalog(actor);
  } catch (error) {
    if (error instanceof DomainError) redirect("/dashboard");
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
        <Link href={`/dashboard/organizations/${organizationId}`} className="inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70">
          {t.dashboard.insights}
        </Link>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.integrations.title}</h1>
        <Card>
          <IntegrationsPanel organizationId={organizationId} initialItems={items} labels={t.integrations} />
        </Card>
      </main>
    </div>
  );
}
