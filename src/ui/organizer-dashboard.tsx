import Link from "next/link";
import type { AdvancedAnalytics, OrganizerDashboard } from "@/domain/analytics/types";
import { formatMoney } from "@/domain/payments/currencies";
import { Card } from "@/ui/card";
import { ExportButtons } from "@/ui/export-buttons";

export function OrganizerDashboardView({
  organizationId,
  dashboard,
  advanced,
  labels,
}: {
  organizationId: string;
  dashboard: OrganizerDashboard;
  advanced: AdvancedAnalytics;
  labels: {
    followers: string;
    upcoming: string;
    rsvps: string;
    revenue: string;
    heatmap: string;
    topEvents: string;
    export: string;
    advanced: string;
    proOnly: string;
  };
}) {
  const lastRevenue = dashboard.monthlyRevenue.at(-1);
  const lastRsvps = dashboard.monthlyRsvps.at(-1);
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-500">{labels.followers}</p>
          <p className="text-3xl font-semibold tabular-nums">{dashboard.followers}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">{labels.rsvps}</p>
          <p className="text-3xl font-semibold tabular-nums">{lastRsvps?.count ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">{labels.revenue}</p>
          <p className="text-3xl font-semibold tabular-nums">
            {formatMoney(lastRevenue?.capturedCents ?? 0, "EUR")}
          </p>
        </Card>
      </div>
      <Card>
        <h2 className="text-lg font-medium">{labels.upcoming}</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {dashboard.upcomingEvents.length === 0 ? <li>—</li> : null}
          {dashboard.upcomingEvents.map((event) => (
            <li key={event.id} className="flex justify-between gap-3">
              <Link className="underline" href={`/dashboard/organizations/${organizationId}/events/${event.id}`}>
                {event.title}
              </Link>
              <span>{event.rsvps}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="text-lg font-medium">{labels.heatmap}</h2>
        <div className="mt-3 flex flex-wrap gap-1">
          {dashboard.heatmap.map((cell) => (
            <span
              key={cell.date}
              title={`${cell.date}: ${cell.count}`}
              className="size-3 rounded-sm"
              style={{ backgroundColor: cell.count === 0 ? "#e4e4e7" : `rgba(24,24,27,${Math.min(1, 0.2 + cell.count / 8)})` }}
            />
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-medium">{labels.topEvents}</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {dashboard.topEvents.map((event) => (
            <li key={event.id} className="flex justify-between gap-3">
              <Link className="underline" href={`/dashboard/organizations/${organizationId}/events/${event.id}`}>
                {event.title}
              </Link>
              <span>
                {event.rsvps} · {event.attendance} · {formatMoney(event.revenueCents, "EUR")}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="text-lg font-medium">{labels.advanced}</h2>
        {advanced.available ? (
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Cohorts</dt>
              <dd>{advanced.cohorts.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>UTM</dt>
              <dd>{advanced.utm.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Geo</dt>
              <dd>{advanced.geo.map((item) => item.place).join(", ") || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Forecast</dt>
              <dd>{formatMoney(advanced.forecast.nextMonthRevenueCents, "EUR")}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">{labels.proOnly}</p>
        )}
      </Card>
      <ExportButtons kind="organizer" organizationId={organizationId} label={labels.export} />
    </div>
  );
}
