import { getSession } from "@/auth/session";
import { unavailablePublicStatus } from "@/domain/support/service";
import { getI18n } from "@/i18n/server";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export default async function StatusPage() {
  const session = await getSession();
  const { t } = await getI18n();
  let snapshot;
  try {
    snapshot = await getServices().support.publicStatus();
  } catch {
    snapshot = unavailablePublicStatus();
  }
  const headline =
    snapshot.status === "operational"
      ? t.statusPage.operational
      : snapshot.status === "degraded"
        ? t.statusPage.degraded
        : snapshot.status === "outage"
          ? t.statusPage.outage
          : t.statusPage.maintenance;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader t={t} signedIn={Boolean(session?.user)} />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.statusPage.title}</h1>
        <Card>
          <p className="text-lg font-medium">{headline}</p>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.statusPage.incidents}</h2>
          {snapshot.incidents.length === 0 ? (
            <p className="text-sm text-zinc-600">{t.statusPage.none}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {snapshot.incidents.map((incident) => (
                <li key={incident.id}>
                  <p className="font-medium">{incident.title}</p>
                  <p className="text-sm text-zinc-600">
                    {incident.severity} · {incident.status} · {incident.provider}
                  </p>
                  <p className="text-sm text-zinc-600">{incident.impact}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.statusPage.scheduled}</h2>
          {snapshot.maintenance.length === 0 ? (
            <p className="text-sm text-zinc-600">—</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {snapshot.maintenance.map((item) => (
                <li key={item.id}>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-zinc-600">
                    {item.status} · {item.startsAt.toISOString()} → {item.endsAt.toISOString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.statusPage.uptime}</h2>
          {snapshot.uptime.length === 0 ? (
            <p className="text-sm text-zinc-600">—</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {snapshot.uptime.map((row) => (
                <li key={row.id}>
                  {row.component} · {row.day} · {formatBps(row.uptimeBps)}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.statusPage.history}</h2>
          {snapshot.historicalIncidents.length === 0 ? (
            <p className="text-sm text-zinc-600">—</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {snapshot.historicalIncidents.map((incident) => (
                <li key={incident.id}>
                  <p className="font-medium">{incident.title}</p>
                  <p className="text-sm text-zinc-600">
                    {incident.severity} · {incident.startedAt.toISOString()}
                    {incident.resolvedAt ? ` → ${incident.resolvedAt.toISOString()}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
