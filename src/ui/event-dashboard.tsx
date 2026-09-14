import type { EventDashboard } from "@/domain/analytics/types";
import { formatMoney } from "@/domain/payments/currencies";
import { Card } from "@/ui/card";
import { ExportButtons } from "@/ui/export-buttons";

export function EventDashboardView({
  dashboard,
  labels,
}: {
  dashboard: EventDashboard;
  labels: {
    registrants: string;
    pageViews: string;
    rsvps: string;
    attendance: string;
    funnel: string;
    emails: string;
    sms: string;
    refunds: string;
    adjustments: string;
    export: string;
  };
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-500">{labels.pageViews}</p>
          <p className="text-3xl font-semibold tabular-nums">{dashboard.pageViews}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">{labels.rsvps}</p>
          <p className="text-3xl font-semibold tabular-nums">{dashboard.rsvps}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">{labels.attendance}</p>
          <p className="text-3xl font-semibold tabular-nums">
            {dashboard.attendance.checkedIn}
            {dashboard.attendance.rate != null ? ` · ${Math.round(dashboard.attendance.rate * 100)}%` : ""}
          </p>
        </Card>
      </div>
      <Card>
        <h2 className="text-lg font-medium">{labels.funnel}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {dashboard.funnel.viewed} → {dashboard.funnel.registered} → {dashboard.funnel.confirmed} →{" "}
          {dashboard.funnel.checkedIn}
        </p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-lg font-medium">{labels.emails}</h2>
          <p className="mt-2 text-sm">
            {dashboard.emails.sent} sent · {dashboard.emails.opened} opened · {dashboard.emails.failed} failed
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-medium">{labels.sms}</h2>
          <p className="mt-2 text-sm">
            {dashboard.sms.sent} sent · {dashboard.sms.failed} failed
          </p>
        </Card>
      </div>
      <Card>
        <h2 className="text-lg font-medium">{labels.registrants}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="py-2">Name</th>
                <th>Status</th>
                <th>Source</th>
                <th>Tags</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.registrants.map((guest) => (
                <tr key={guest.registrationId} className="border-b border-zinc-100">
                  <td className="py-2">
                    {guest.displayName}
                    {guest.email ? <span className="block text-zinc-500">{guest.email}</span> : null}
                  </td>
                  <td>{guest.status}</td>
                  <td>{guest.source}</td>
                  <td>{guest.tags.join(", ")}</td>
                  <td>{guest.registeredAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-medium">{labels.refunds}</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {dashboard.refunds.length === 0 ? <li>—</li> : null}
          {dashboard.refunds.map((item) => (
            <li key={item.id}>
              {formatMoney(item.amountCents, "EUR")} · {item.reason}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="text-lg font-medium">{labels.adjustments}</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {dashboard.adjustments.length === 0 ? <li>—</li> : null}
          {dashboard.adjustments.map((item) => (
            <li key={item.orderId}>
              {formatMoney(item.discountCents, item.currency)} · {item.orderId}
            </li>
          ))}
        </ul>
      </Card>
      <ExportButtons
        kind="registrants"
        organizationId={dashboard.organizationId}
        eventId={dashboard.eventId}
        label={labels.export}
      />
    </div>
  );
}
