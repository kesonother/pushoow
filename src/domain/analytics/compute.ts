import type { EventOrder, EventRegistration } from "@/domain/event/commerce-types";
import type { Event } from "@/domain/event/types";
import type { NotificationDelivery } from "@/domain/notification/types";
import type { CheckoutPayment, PaymentRefund } from "@/domain/payments/types";
import type {
  AdvancedAnalytics,
  EventDashboard,
  OrganizerDashboard,
  PageViewDaily,
  RegistrationAttribution,
  RegistrationSource,
} from "@/domain/analytics/types";

const ACTIVE = new Set(["pending", "confirmed", "offered", "checked_in"]);
const CONFIRMED = new Set(["confirmed", "checked_in", "offered"]);

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function utcMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function monthsBack(now: Date, count: number): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = count - 1; i >= 0; i -= 1) {
    const item = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
    months.push(utcMonth(item));
  }
  return months;
}

function daysBack(now: Date, count: number): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    days.push(utcDay(new Date(now.getTime() - i * 86_400_000)));
  }
  return days;
}

function displayName(registration: EventRegistration) {
  if (registration.anonymous) return "Guest";
  return registration.email.split("@")[0] ?? registration.email;
}

export function inferSource(
  registration: EventRegistration,
  attribution: RegistrationAttribution | undefined,
  walkIns: Set<string>,
): RegistrationSource {
  if (attribution?.source) return attribution.source;
  if (walkIns.has(registration.id)) return "walk_in";
  if (registration.orderId) return "checkout";
  return "direct";
}

export function buildOrganizerDashboard(input: {
  organizationId: string;
  now: Date;
  events: Event[];
  registrations: EventRegistration[];
  followers: number;
  payments: CheckoutPayment[];
  refunds: PaymentRefund[];
  orders: EventOrder[];
  attendanceByEvent: Map<string, number>;
  includeRevenue: boolean;
}): OrganizerDashboard {
  const live = input.events.filter((event) => !event.deletedAt);
  const liveIds = new Set(live.map((event) => event.id));
  const regs = input.registrations.filter((item) => liveIds.has(item.eventId));
  const months = monthsBack(input.now, 12);
  const rsvpByMonth = new Map(months.map((month) => [month, 0]));
  for (const registration of regs) {
    const month = utcMonth(registration.createdAt);
    if (rsvpByMonth.has(month)) rsvpByMonth.set(month, (rsvpByMonth.get(month) ?? 0) + registration.quantity);
  }
  const orderEvent = new Map(input.orders.map((order) => [order.id, order.eventId]));
  const capturedByMonth = new Map(months.map((month) => [month, 0]));
  const refundedByMonth = new Map(months.map((month) => [month, 0]));
  if (input.includeRevenue) {
    for (const payment of input.payments) {
      if (payment.status !== "paid" && payment.status !== "partially_refunded") continue;
      const month = utcMonth(payment.createdAt);
      if (capturedByMonth.has(month)) {
        capturedByMonth.set(month, (capturedByMonth.get(month) ?? 0) + payment.amountCents);
      }
    }
    for (const refund of input.refunds) {
      const month = utcMonth(refund.createdAt);
      if (refundedByMonth.has(month)) {
        refundedByMonth.set(month, (refundedByMonth.get(month) ?? 0) + refund.amountCents);
      }
    }
  }
  const days = daysBack(input.now, 84);
  const heat = new Map(days.map((day) => [day, 0]));
  for (const registration of regs) {
    const day = utcDay(registration.createdAt);
    if (heat.has(day)) heat.set(day, (heat.get(day) ?? 0) + registration.quantity);
  }
  const rsvpsByEvent = new Map<string, number>();
  for (const registration of regs) {
    if (!ACTIVE.has(registration.status)) continue;
    rsvpsByEvent.set(registration.eventId, (rsvpsByEvent.get(registration.eventId) ?? 0) + registration.quantity);
  }
  const revenueByEvent = new Map<string, number>();
  if (input.includeRevenue) {
    for (const payment of input.payments) {
      if (payment.status !== "paid" && payment.status !== "partially_refunded") continue;
      const eventId = orderEvent.get(payment.orderId);
      if (!eventId) continue;
      revenueByEvent.set(eventId, (revenueByEvent.get(eventId) ?? 0) + payment.amountCents);
    }
  }
  const upcoming = live
    .filter((event) => event.startsAt >= input.now && event.status !== "cancelled")
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
    .slice(0, 8)
    .map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      rsvps: rsvpsByEvent.get(event.id) ?? 0,
    }));
  const topEvents = [...live]
    .map((event) => ({
      id: event.id,
      title: event.title,
      rsvps: rsvpsByEvent.get(event.id) ?? 0,
      attendance: input.attendanceByEvent.get(event.id) ?? 0,
      revenueCents: input.includeRevenue ? (revenueByEvent.get(event.id) ?? 0) : 0,
    }))
    .sort((left, right) => right.rsvps - left.rsvps || right.revenueCents - left.revenueCents)
    .slice(0, 8);

  return {
    organizationId: input.organizationId,
    computedAt: input.now.toISOString(),
    stale: false,
    followers: input.followers,
    upcomingEvents: upcoming,
    monthlyRsvps: months.map((month) => ({ month, count: rsvpByMonth.get(month) ?? 0 })),
    monthlyRevenue: months.map((month) => ({
      month,
      capturedCents: capturedByMonth.get(month) ?? 0,
      refundedCents: refundedByMonth.get(month) ?? 0,
    })),
    heatmap: days.map((date) => ({ date, count: heat.get(date) ?? 0 })),
    topEvents,
  };
}

export function buildEventDashboard(input: {
  event: Event;
  now: Date;
  registrations: EventRegistration[];
  attributions: RegistrationAttribution[];
  walkIns: Set<string>;
  pageViews: PageViewDaily[];
  checkedIn: number;
  deliveries: NotificationDelivery[];
  refunds: PaymentRefund[];
  orders: EventOrder[];
  includeFinance: boolean;
}): EventDashboard {
  const attr = new Map(input.attributions.map((item) => [item.registrationId, item]));
  const emails = new Set(input.registrations.map((item) => item.email.toLowerCase()));
  const registrants = [...input.registrations]
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((registration) => ({
      registrationId: registration.id,
      displayName: displayName(registration),
      email: registration.anonymous ? "" : registration.email,
      status: registration.status,
      tags: attr.get(registration.id)?.tags ?? input.event.tags,
      registeredAt: registration.createdAt.toISOString(),
      source: inferSource(registration, attr.get(registration.id), input.walkIns),
    }));
  const rsvps = input.registrations
    .filter((item) => ACTIVE.has(item.status))
    .reduce((sum, item) => sum + item.quantity, 0);
  const confirmed = input.registrations
    .filter((item) => CONFIRMED.has(item.status))
    .reduce((sum, item) => sum + item.quantity, 0);
  const views = input.pageViews.reduce((sum, item) => sum + item.views, 0);
  const related = input.deliveries.filter((item) => emails.has(item.to.toLowerCase()));
  const emailRows = related.filter((item) => item.channel === "email");
  const smsRows = related.filter((item) => item.channel === "sms");
  return {
    eventId: input.event.id,
    organizationId: input.event.organizationId,
    title: input.event.title,
    computedAt: input.now.toISOString(),
    stale: false,
    registrants,
    pageViews: views,
    rsvps,
    attendance: {
      checkedIn: input.checkedIn,
      rate: rsvps > 0 ? input.checkedIn / rsvps : null,
    },
    funnel: {
      viewed: views,
      registered: input.registrations.length,
      confirmed,
      checkedIn: input.checkedIn,
    },
    emails: {
      sent: emailRows.filter((item) => item.status === "sent").length,
      opened: emailRows.filter((item) => item.openedAt).length,
      failed: emailRows.filter((item) => item.status === "failed").length,
    },
    sms: {
      sent: smsRows.filter((item) => item.status === "sent").length,
      failed: smsRows.filter((item) => item.status === "failed").length,
    },
    refunds: input.includeFinance
      ? input.refunds.map((item) => ({
          id: item.id,
          amountCents: item.amountCents,
          reason: item.reason,
          createdAt: item.createdAt.toISOString(),
        }))
      : [],
    adjustments: input.includeFinance
      ? input.orders
          .filter((order) => order.discountCents > 0)
          .map((order) => ({
            orderId: order.id,
            discountCents: order.discountCents,
            currency: order.currency,
          }))
      : [],
  };
}

export function buildAdvancedAnalytics(input: {
  plan: AdvancedAnalytics["plan"];
  events: Event[];
  registrations: EventRegistration[];
  attributions: RegistrationAttribution[];
  views: PageViewDaily[];
  attendanceByEvent: Map<string, number>;
  payments: CheckoutPayment[];
  orders: EventOrder[];
  deliveries: NotificationDelivery[];
}): AdvancedAnalytics {
  const available = input.plan === "pro" || input.plan === "plus";
  const empty: AdvancedAnalytics = {
    available,
    plan: input.plan,
    eventComparison: [],
    cohorts: [],
    utm: [],
    geo: [],
    deliverability: {
      email: { sent: 0, opened: 0, clicked: 0, failed: 0, openRate: null },
      sms: { sent: 0, failed: 0 },
    },
    forecast: { nextMonthRevenueCents: 0, method: "trailing_average" },
  };
  if (!available) return empty;

  const live = input.events.filter((event) => !event.deletedAt);
  const viewsByEvent = new Map<string, number>();
  for (const row of input.views) {
    viewsByEvent.set(row.eventId, (viewsByEvent.get(row.eventId) ?? 0) + row.views);
  }
  const rsvpsByEvent = new Map<string, number>();
  for (const registration of input.registrations) {
    if (!ACTIVE.has(registration.status)) continue;
    rsvpsByEvent.set(registration.eventId, (rsvpsByEvent.get(registration.eventId) ?? 0) + registration.quantity);
  }
  const orderEvent = new Map(input.orders.map((order) => [order.id, order.eventId]));
  const revenueByEvent = new Map<string, number>();
  const captured: number[] = [];
  for (const payment of input.payments) {
    if (payment.status !== "paid" && payment.status !== "partially_refunded") continue;
    captured.push(payment.amountCents);
    const eventId = orderEvent.get(payment.orderId);
    if (eventId) revenueByEvent.set(eventId, (revenueByEvent.get(eventId) ?? 0) + payment.amountCents);
  }
  const eventComparison = live
    .slice()
    .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime())
    .slice(0, 6)
    .map((event) => ({
      eventId: event.id,
      title: event.title,
      rsvps: rsvpsByEvent.get(event.id) ?? 0,
      attendance: input.attendanceByEvent.get(event.id) ?? 0,
      revenueCents: revenueByEvent.get(event.id) ?? 0,
      pageViews: viewsByEvent.get(event.id) ?? 0,
    }));
  const cohortMap = new Map<string, { registered: number; attended: number }>();
  const attended = new Set(
    input.registrations.filter((item) => item.status === "checked_in").map((item) => item.id),
  );
  for (const registration of input.registrations) {
    const month = utcMonth(registration.createdAt);
    const current = cohortMap.get(month) ?? { registered: 0, attended: 0 };
    current.registered += 1;
    if (attended.has(registration.id)) current.attended += 1;
    cohortMap.set(month, current);
  }
  const utmMap = new Map<string, number>();
  for (const item of input.attributions) {
    const key = item.utmSource ?? item.source;
    utmMap.set(key, (utmMap.get(key) ?? 0) + 1);
  }
  const geoMap = new Map<string, { events: number; rsvps: number }>();
  for (const event of live) {
    const place = [event.city, event.country].filter(Boolean).join(", ") || "unknown";
    const current = geoMap.get(place) ?? { events: 0, rsvps: 0 };
    current.events += 1;
    current.rsvps += rsvpsByEvent.get(event.id) ?? 0;
    geoMap.set(place, current);
  }
  const emails = input.deliveries.filter((item) => item.channel === "email");
  const sms = input.deliveries.filter((item) => item.channel === "sms");
  const sent = emails.filter((item) => item.status === "sent").length;
  const opened = emails.filter((item) => item.openedAt).length;
  const lastThree = captured.slice(-3);
  const forecast =
    lastThree.length === 0 ? 0 : Math.round(lastThree.reduce((sum, item) => sum + item, 0) / lastThree.length);

  return {
    available: true,
    plan: input.plan,
    eventComparison,
    cohorts: [...cohortMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, value]) => ({ month, ...value })),
    utm: [...utmMap.entries()].map(([source, registrations]) => ({ source, registrations })),
    geo: [...geoMap.entries()].map(([place, value]) => ({ place, ...value })),
    deliverability: {
      email: {
        sent,
        opened,
        clicked: emails.filter((item) => item.clickedAt).length,
        failed: emails.filter((item) => item.status === "failed").length,
        openRate: sent > 0 ? opened / sent : null,
      },
      sms: {
        sent: sms.filter((item) => item.status === "sent").length,
        failed: sms.filter((item) => item.status === "failed").length,
      },
    },
    forecast: { nextMonthRevenueCents: forecast, method: "trailing_average" },
  };
}

export function rowsFromOrganizer(dashboard: OrganizerDashboard) {
  return dashboard.topEvents.map((event) => ({
    event: event.title,
    rsvps: event.rsvps,
    attendance: event.attendance,
    revenueCents: event.revenueCents,
  }));
}

export function rowsFromEvent(dashboard: EventDashboard) {
  return dashboard.registrants.map((item) => ({
    name: item.displayName,
    email: item.email,
    status: item.status,
    source: item.source,
    tags: item.tags.join("|"),
    registeredAt: item.registeredAt,
  }));
}
