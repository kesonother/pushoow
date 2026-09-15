import { getSession } from "@/auth/session";
import { unavailablePublicStatus } from "@/domain/support/service";
import { formatEventDateTime } from "@/i18n/datetime";
import type { Dictionary } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { enrichPublicStatus } from "@/observability/status-page";
import type { StatusComponent, StatusSloCard } from "@/observability/status-page";
import { getServices } from "@/server/container";
import { Card } from "@/ui/card";
import { SiteHeader } from "@/ui/site-header";

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function componentLabel(t: Dictionary, component: StatusComponent): string {
  const labels = {
    api: t.statusPage.componentApi,
    database: t.statusPage.componentDatabase,
    queue: t.statusPage.componentQueue,
    payments: t.statusPage.componentPayments,
    email: t.statusPage.componentEmail,
    webhooks: t.statusPage.componentWebhooks,
  };
  return labels[component.id];
}

function componentStatusLabel(t: Dictionary, status: StatusComponent["status"]): string {
  if (status === "operational") return t.statusPage.operational;
  if (status === "degraded") return t.statusPage.degraded;
  return t.statusPage.outage;
}

function sloLabel(t: Dictionary, slo: StatusSloCard): string {
  if (slo.id === "availability") return t.statusPage.sloAvailability;
  if (slo.id === "publicPageP95Ms") return t.statusPage.sloPublicPage;
  if (slo.id === "dashboardP95Ms") return t.statusPage.sloDashboard;
  return t.statusPage.sloCheckout;
}

function sloValue(t: Dictionary, slo: StatusSloCard): string {
  const state =
    slo.met === null ? t.statusPage.sloPending : slo.met ? t.statusPage.sloMet : t.statusPage.sloMissed;
  if (slo.current === null) return state;
  const value = slo.unit === "ms" ? `${Math.round(slo.current)}ms` : `${(slo.current * 100).toFixed(2)}%`;
  return `${value} · ${state}`;
}

export default async function StatusPage() {
  const session = await getSession();
  const { t, locale } = await getI18n();
  let snapshot;
  try {
    snapshot = await enrichPublicStatus(await getServices().support.publicStatus());
  } catch {
    snapshot = await enrichPublicStatus(unavailablePublicStatus());
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
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader t={t} signedIn={Boolean(session?.user)} />
      <main id="content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111111]">{t.statusPage.title}</h1>
        <Card>
          <p className="text-lg font-medium">{headline}</p>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.statusPage.components}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {snapshot.components.map((component) => (
              <li key={component.id} className="flex items-center justify-between gap-4">
                <span>{componentLabel(t, component)}</span>
                <span className="text-zinc-600">{componentStatusLabel(t, component.status)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{t.statusPage.slos}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {snapshot.slos.map((slo) => (
              <li key={slo.id} className="flex items-center justify-between gap-4">
                <span>{sloLabel(t, slo)}</span>
                <span className="text-zinc-600">{sloValue(t, slo)}</span>
              </li>
            ))}
          </ul>
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
                    {item.status} · {formatEventDateTime(item.startsAt, "UTC", locale)}{" "}
                    <span className="rtl-flip inline-block">→</span> {formatEventDateTime(item.endsAt, "UTC", locale)}
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
                    {incident.severity} · {formatEventDateTime(incident.startedAt, "UTC", locale)}
                    {incident.resolvedAt ? (
                      <>
                        {" "}
                        <span className="rtl-flip inline-block">→</span>{" "}
                        {formatEventDateTime(incident.resolvedAt, "UTC", locale)}
                      </>
                    ) : (
                      ""
                    )}
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
