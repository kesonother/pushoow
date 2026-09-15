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

export default async function OrganizationAuditPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId } = await params;
  const { t } = await getI18n();
  const services = getServices();
  let logs;
  let actor;
  try {
    actor = await requireFullDashboardActor(
      services.access,
      session.user.id,
      organizationId,
      Boolean(session.user.emailVerified),
    );
    logs = await services.audit.list(actor);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.dashboard.audit}</h1>
          {hasPermission(actor, "exports:create") ? (
            <Link
              href={`/api/v1/organizations/${organizationId}/audit/export.csv`}
              className="inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70"
            >
              {t.dashboard.exportCsv}
            </Link>
          ) : null}
        </div>
        <OrgNav organizationId={organizationId} actor={actor} labels={t.dashboard} />
        <ul className="flex flex-col gap-3">
          {logs.slice(0, 50).map((log) => (
            <li key={log.id}>
              <Card>
                <p className="font-medium">{log.action}</p>
                <p className="text-sm text-zinc-600">
                  {log.createdAt.toISOString()} · {log.actorUserId ?? "system"} · {log.ipAddress ?? "—"}
                </p>
                <p className="text-sm text-zinc-600">
                  {log.resourceType}
                  {log.resourceId ? `:${log.resourceId}` : ""}
                </p>
                {log.userAgent ? <p className="truncate text-xs text-zinc-600">{log.userAgent}</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
