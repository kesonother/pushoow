import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { requireFullDashboardActor } from "@/server/dashboard-access";
import { DomainError } from "@/domain/errors";
import { hasPermission } from "@/domain/rbac/permissions";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { OrgNav } from "@/ui/org-nav";
import { SiteHeader } from "@/ui/site-header";
import { SupportTicketActions } from "@/ui/support-ticket-actions";

export default async function OrganizationSupportTicketPage({
  params,
}: {
  params: Promise<{ organizationId: string; ticketId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId, ticketId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let actor;
  let conversation;
  try {
    actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    conversation = await services.support.getConversation(actor, ticketId);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  const { ticket, sla, messages, history } = conversation;
  const attachments = messages.flatMap((item) => item.attachments);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <Link href={`/dashboard/organizations/${organizationId}/support`} className="text-sm underline">
            {t.dashboard.support}
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {ticket.number} · {ticket.subject}
          </h1>
        </div>
        <OrgNav organizationId={organizationId} actor={actor} labels={t.dashboard} />
        <Card>
          <p className="text-sm text-zinc-600">{t.dashboard.supportHumanFirst}</p>
          <p className="mt-3 text-sm text-zinc-700">
            {t.dashboard.supportStatus}: <strong>{ticket.status}</strong> · {t.dashboard.supportPriority}:{" "}
            {ticket.priority} · {t.dashboard.supportChannel}: {ticket.channel}
          </p>
          {ticket.assignedToUserId ? (
            <p className="text-sm text-zinc-600">
              {t.dashboard.supportAssignee}: {ticket.assignedToUserId}
            </p>
          ) : null}
          {sla.applicable ? (
            <p className="mt-2 text-sm text-zinc-600">
              {t.dashboard.supportSla}: {t.dashboard.supportFirstResponse} {sla.firstResponseDueAt} ·{" "}
              {t.dashboard.supportResolution} {sla.resolutionDueAt}
              {sla.firstResponseBreached || sla.resolutionBreached ? ` · ${t.dashboard.supportBreached}` : ""}
            </p>
          ) : null}
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t.dashboard.supportConversation}</h2>
          <ol className="flex flex-col gap-4">
            {messages.map((message) => (
              <li key={message.id} className="rounded-xl border border-zinc-200 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {message.authorKind}
                  {message.visibility === "internal" ? ` · ${t.dashboard.supportInternal}` : ""} ·{" "}
                  {message.createdAt.toISOString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{message.body}</p>
                {message.attachments.length > 0 ? (
                  <ul className="mt-2 text-sm">
                    {message.attachments.map((file) => (
                      <li key={file.id ?? file.url}>
                        <a href={file.url} className="underline">
                          {file.filename}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
        {attachments.length > 0 ? (
          <Card>
            <h2 className="mb-3 text-lg font-semibold">{t.dashboard.supportAttachments}</h2>
            <ul className="text-sm">
              {attachments.map((file) => (
                <li key={file.id ?? file.url}>
                  <a href={file.url} className="underline">
                    {file.filename}
                  </a>{" "}
                  <span className="text-zinc-500">({file.contentType})</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.dashboard.supportHistory}</h2>
          <ol className="flex flex-col gap-2 text-sm text-zinc-700">
            {history.map((event) => (
              <li key={event.id}>
                {event.createdAt.toISOString()} · {event.type}
                {event.actorUserId ? ` · ${event.actorUserId}` : ""}
              </li>
            ))}
          </ol>
        </Card>
        {hasPermission(actor, "support:write") || hasPermission(actor, "support:manage") ? (
          <Card>
            <SupportTicketActions
              organizationId={organizationId}
              ticketId={ticket.id}
              canManage={hasPermission(actor, "support:manage")}
              labels={{
                reply: t.dashboard.supportReply,
                internal: t.dashboard.supportInternal,
                assign: t.dashboard.supportAssign,
                status: t.dashboard.supportStatus,
                priority: t.dashboard.supportPriority,
                message: t.dashboard.supportMessage,
              }}
            />
          </Card>
        ) : null}
      </main>
    </div>
  );
}
