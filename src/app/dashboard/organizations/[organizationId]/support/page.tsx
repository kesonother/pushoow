import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { DomainError } from "@/domain/errors";
import { hasPermission } from "@/domain/rbac/permissions";
import { slaPolicyFromEntitlements, slaViewFor } from "@/domain/support/sla";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { OrgNav } from "@/ui/org-nav";
import { SiteHeader } from "@/ui/site-header";
import { SupportTicketForm } from "@/ui/support-ticket-form";

export default async function OrganizationSupportPage({
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
  let tickets;
  let aroundTheClock = false;
  try {
    actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    tickets = await services.support.listTickets(actor);
    const entitlements = await services.billing.entitlementsFor(organizationId);
    aroundTheClock = slaPolicyFromEntitlements(entitlements.planId, entitlements.supportSlaHours).aroundTheClock;
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  const now = new Date();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.dashboard.supportTitle}</h1>
        <OrgNav organizationId={organizationId} actor={actor} labels={t.dashboard} />
        <Card>
          <p className="text-sm text-zinc-600">{t.dashboard.supportHumanFirst}</p>
          <p className="mt-2 text-sm text-zinc-600">{t.dashboard.supportHint}</p>
        </Card>
        {hasPermission(actor, "support:write") ? (
          <Card>
            <SupportTicketForm
              organizationId={organizationId}
              labels={{
                create: t.dashboard.supportCreate,
                subject: t.dashboard.supportSubject,
                message: t.dashboard.supportMessage,
                priority: t.dashboard.supportPriority,
                channel: t.dashboard.supportChannel,
              }}
            />
          </Card>
        ) : null}
        {tickets.length === 0 ? (
          <p className="text-sm text-zinc-600">{t.dashboard.supportEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tickets.map((ticket) => {
              const sla = slaViewFor(ticket, now, aroundTheClock);
              return (
                <li key={ticket.id}>
                  <Card>
                    <Link
                      href={`/dashboard/organizations/${organizationId}/support/${ticket.id}`}
                      className="font-medium underline"
                    >
                      {ticket.number} · {ticket.subject}
                    </Link>
                    <p className="mt-2 text-sm text-zinc-600">
                      {t.dashboard.supportStatus}: {ticket.status} · {t.dashboard.supportPriority}: {ticket.priority} ·{" "}
                      {t.dashboard.supportChannel}: {ticket.channel}
                    </p>
                    {sla.applicable ? (
                      <p className="text-sm text-zinc-600">
                        {t.dashboard.supportSla}: {t.dashboard.supportFirstResponse} {sla.firstResponseDueAt}
                        {sla.firstResponseBreached ? ` · ${t.dashboard.supportBreached}` : ""}
                      </p>
                    ) : null}
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
