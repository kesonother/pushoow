import { describe, expect, it } from "vitest";
import { createAnalyticsService } from "@/domain/analytics/service";
import {
  memoryAnalyticsPlans,
  memoryAttributions,
  memoryPageViews,
  memorySnapshots,
} from "@/domain/analytics/memory";
import { toCsv, toXlsx } from "@/domain/analytics/export";
import { memoryCheckInPasses, memoryCheckInRecords } from "@/domain/checkin/memory";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import { createRegistrationService } from "@/domain/event/registration-service";
import { ForbiddenError } from "@/domain/errors";
import { memoryDeliveries } from "@/domain/notification/memory";
import { memoryCheckoutPayments, memoryIssuedTickets, memoryPaymentRefunds } from "@/domain/payments/memory";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryCalendars,
  createMemoryCoupons,
  createMemoryAddOns,
  createMemoryEvents,
  createMemoryFollowers,
  createMemoryOrders,
  createMemoryRegistrations,
  createMemoryTickets,
} from "@/test/fakes";

const owner: Actor = {
  userId: "user_1",
  organizationId: "org_1",
  role: "owner",
  emailVerified: true,
};

const door: Actor = {
  userId: "door_1",
  organizationId: "org_1",
  role: "check_in_manager",
};

const outsider: Actor = {
  userId: "x",
  organizationId: "org_2",
  role: "owner",
};

async function setup() {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const registrations = createMemoryRegistrations();
  const tickets = createMemoryTickets();
  const orders = createMemoryOrders();
  const followers = createMemoryFollowers();
  const payments = memoryCheckoutPayments();
  const refunds = memoryPaymentRefunds();
  const issuedTickets = memoryIssuedTickets();
  const records = memoryCheckInRecords();
  const passes = memoryCheckInPasses();
  const deliveries = memoryDeliveries();
  const attributions = memoryAttributions();
  const pageViews = memoryPageViews();
  const snapshots = memorySnapshots();
  const plans = memoryAnalyticsPlans();
  const register = createRegistrationService({
    events,
    registrations,
    tickets,
    coupons: createMemoryCoupons(),
    addOns: createMemoryAddOns(),
    orders,
  });
  const calendar = await createCalendarService({ calendars }).createCalendar(owner, { name: "Insights" });
  const eventService = createEventService({ events, calendars, registrations: register });
  const event = await eventService.createEvent(owner, {
    calendarId: calendar.id,
    title: "Launch",
    startsAt: new Date("2026-11-01T18:00:00.000Z"),
    endsAt: new Date("2026-11-01T21:00:00.000Z"),
    status: "published",
    city: "Paris",
    country: "FR",
  });
  await followers.create({
    id: "fol_1",
    organizationId: "org_1",
    calendarId: calendar.id,
    userId: "fan_1",
    preferences: { email: true, push: false, sms: false },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const analytics = createAnalyticsService({
    events,
    calendars,
    registrations,
    orders,
    followers,
    payments,
    refunds,
    issuedTickets,
    records,
    passes,
    deliveries,
    attributions,
    pageViews,
    snapshots,
    plans,
    secret: "analytics-test-secret-32-characters!!",
  });
  return {
    event,
    register,
    analytics,
    payments,
    refunds,
    records,
    deliveries,
    attributions,
    plans,
    followers,
    calendars,
  };
}

describe("organizer and event dashboards", () => {
  it("aggregates followers, RSVPs, heatmap, top events and revenue without recomputing when cached", async () => {
    const { event, register, analytics, payments, records } = await setup();
    const guest = await register.register({
      eventId: event.id,
      email: "ada@example.com",
      userId: "ada",
    });
    await payments.create({
      id: "pay_1",
      organizationId: "org_1",
      orderId: "ord_missing",
      amountCents: 2500,
      currency: "EUR",
      status: "paid",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      checkoutUrl: null,
      applicationFeeCents: 62,
      taxCents: 0,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      updatedAt: new Date("2026-09-01T10:00:00.000Z"),
    });
    await records.create({
      id: "rec_1",
      organizationId: "org_1",
      eventId: event.id,
      registrationId: guest.id,
      issuedTicketId: null,
      actorUserId: "door_1",
      source: "scan",
      deviceId: null,
      clientOpId: "op_dash",
      checkedInAt: new Date(),
      createdAt: new Date(),
    });

    const first = await analytics.organizerDashboard(owner);
    const second = await analytics.organizerDashboard(owner);
    expect(first.followers).toBe(1);
    expect(first.topEvents[0]?.rsvps).toBe(1);
    expect(first.topEvents[0]?.attendance).toBe(1);
    expect(first.monthlyRevenue.some((item) => item.capturedCents === 2500)).toBe(true);
    expect(first.heatmap.some((item) => item.count > 0)).toBe(true);
    expect(second.computedAt).toBe(first.computedAt);

    const eventDash = await analytics.eventDashboard(owner, event.id);
    expect(eventDash.rsvps).toBe(1);
    expect(eventDash.funnel.checkedIn).toBe(1);
    expect(eventDash.registrants[0]?.source).toBe("direct");
    expect(eventDash.registrants[0]?.status).toBe("confirmed");
  });

  it("isolates tenants, hides finance from check-in managers, and gates Pro+ analytics", async () => {
    const { event, register, analytics, plans, deliveries } = await setup();
    await register.register({ eventId: event.id, email: "ada@example.com" });
    await deliveries.create({
      id: "d1",
      userId: null,
      channel: "email",
      category: "reminder",
      templateKey: "reminder_24h",
      to: "ada@example.com",
      subject: "See you",
      body: "Tomorrow",
      status: "sent",
      idempotencyKey: "d1",
      providerMessageId: null,
      variant: null,
      openedAt: new Date(),
      clickedAt: null,
      trackingEnabled: true,
      createdAt: new Date(),
    });
    await expect(analytics.organizerDashboard(outsider)).resolves.toMatchObject({ followers: 0, topEvents: [] });
    await expect(analytics.eventDashboard(outsider, event.id)).rejects.toBeInstanceOf(ForbiddenError);
    const doorDash = await analytics.eventDashboard(door, event.id);
    expect(doorDash.refunds).toEqual([]);
    const free = await analytics.advanced(owner);
    expect(free.available).toBe(false);
    await plans.save({ organizationId: "org_1", plan: "pro", updatedAt: new Date() });
    const pro = await analytics.advanced(owner);
    expect(pro.available).toBe(true);
    expect(pro.eventComparison[0]?.eventId).toBe(event.id);
    expect(pro.deliverability.email.opened).toBe(1);
    expect(pro.geo[0]?.place).toContain("Paris");
  });

  it("tracks page views once per visitor per day and exports CSV/XLSX/JSON", async () => {
    const { event, register, analytics } = await setup();
    await register.register({ eventId: event.id, email: "ada@example.com", userId: "ada" });
    await analytics.recordView(event.id, "visitor-a");
    await analytics.recordView(event.id, "visitor-a");
    await analytics.recordView(event.id, "visitor-b");
    const dash = await analytics.refreshEvent(event.id, owner);
    expect(dash.pageViews).toBe(3);
    const csv = await analytics.exportDashboard(owner, { kind: "registrants", format: "csv", eventId: event.id });
    expect(csv.filename).toBe("export.csv");
    expect(csv.body.toString("utf8")).toContain("ada@example.com");
    const xlsx = await analytics.exportDashboard(owner, { kind: "organizer", format: "xlsx" });
    expect(xlsx.body.subarray(0, 2).toString("utf8")).toBe("PK");
    await expect(analytics.exportDashboard(door, { kind: "organizer", format: "json" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const mine = await analytics.attendeeHome("ada");
    expect(mine.events[0]?.title).toBe("Launch");
    expect(mine.tickets[0]?.qrToken).toBeTruthy();
    expect(mine.tickets[0]?.qrToken?.includes("ada@example.com")).toBe(false);
    const self = await analytics.exportDashboard({ userId: "ada" }, { kind: "attendee", format: "json" });
    expect(JSON.parse(self.body.toString("utf8"))[0].registrationId).toBe(mine.tickets[0]?.registrationId);
  });
});

describe("export serializers", () => {
  it("quotes CSV fields and builds a zip xlsx", () => {
    const rows = [{ name: 'Ada "Lovelace"', city: "Paris" }];
    expect(toCsv(rows)).toContain('"Ada ""Lovelace"""');
    expect(toXlsx(rows).subarray(0, 2).toString()).toBe("PK");
  });
});
