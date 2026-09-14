import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/domain/errors";
import { PaymentNotConfiguredError } from "@/domain/calendar/membership-types";
import { memoryCapacityAlerts, memoryCheckInPasses, memoryCheckInRecords } from "@/domain/checkin/memory";
import { signCheckInQr } from "@/domain/checkin/qr";
import { createCheckInService } from "@/domain/checkin/service";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import { createRegistrationService } from "@/domain/event/registration-service";
import { memoryIssuedTickets } from "@/domain/payments/memory";
import { canAccessFullDashboard } from "@/domain/rbac/dashboard";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryCalendars,
  createMemoryCoupons,
  createMemoryAddOns,
  createMemoryEvents,
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
  role: "check_in_manager",
};

async function setup() {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const registrations = createMemoryRegistrations();
  const tickets = createMemoryTickets();
  const issuedTickets = memoryIssuedTickets();
  const alerts: Array<{ threshold: number; emails: string[] }> = [];
  const register = createRegistrationService({
    events,
    registrations,
    tickets,
    coupons: createMemoryCoupons(),
    addOns: createMemoryAddOns(),
    orders: createMemoryOrders(),
  });
  const calendar = await createCalendarService({ calendars }).createCalendar(owner, { name: "Door" });
  const eventService = createEventService({ events, calendars, registrations: register });
  const event = await eventService.createEvent(owner, {
    calendarId: calendar.id,
    title: "Launch night",
    startsAt: new Date("2026-11-01T18:00:00.000Z"),
    endsAt: new Date("2026-11-01T21:00:00.000Z"),
    status: "published",
    capacity: 2,
  });
  const checkin = createCheckInService({
    events,
    registrations,
    tickets,
    issuedTickets,
    passes: memoryCheckInPasses(),
    records: memoryCheckInRecords(),
    alerts: memoryCapacityAlerts(),
    secret: "check-in-test-secret-32-characters!!",
    registrationsService: register,
    listOrganizerEmails: async () => ["owner@example.com"],
    notify: {
      async notifyCapacity(input) {
        alerts.push({ threshold: input.threshold, emails: input.emails });
      },
    },
  });
  return { event, register, checkin, issuedTickets, alerts, tickets };
}

describe("check-in QR and statuses", () => {
  it("checks in once and treats a double scan as already checked-in", async () => {
    const { event, register, checkin } = await setup();
    const guest = await register.register({ eventId: event.id, email: "ada@example.com" });
    const snapshot = await checkin.manifest(door, event.id);
    const token = snapshot.guests[0]!.qrToken;
    const claims = JSON.parse(Buffer.from(token.split(".")[0]!, "base64url").toString("utf8")) as {
      e: string;
      r: string;
    };
    expect(claims.e).toBe(event.id);
    expect(claims.r).toBe(guest.id);
    expect(token.includes("ada@example.com")).toBe(false);

    const first = await checkin.checkIn(door, { eventId: event.id, token, clientOpId: "op_1" });
    const second = await checkin.checkIn(door, { eventId: event.id, token, clientOpId: "op_2" });
    const replay = await checkin.checkIn(door, { eventId: event.id, token, clientOpId: "op_1" });
    expect(first.status).toBe("checked_in");
    expect(second.status).toBe("already_checked_in");
    expect(replay.status).toBe("already_checked_in");
    expect(replay.clientOpId).toBe("op_1");
  });

  it("rejects the wrong event, an invalid token, and a revoked ticket", async () => {
    const { event, register, checkin, issuedTickets } = await setup();
    const guest = await register.register({ eventId: event.id, email: "ada@example.com" });
    const snapshot = await checkin.manifest(door, event.id);
    const other = signCheckInQr(
      { e: "evt_other", r: guest.id, t: null, x: null, n: "pass_x" },
      "check-in-test-secret-32-characters!!",
    );
    expect((await checkin.checkIn(door, { eventId: event.id, token: other, clientOpId: "w" })).status).toBe(
      "wrong_event",
    );
    expect(
      (await checkin.checkIn(door, { eventId: event.id, token: "not-a-token", clientOpId: "i" })).status,
    ).toBe("invalid");

    await issuedTickets.createMany([
      {
        id: "tix_1",
        organizationId: "org_1",
        eventId: event.id,
        orderId: "ord_1",
        registrationId: guest.id,
        ticketTypeId: null,
        code: "TIX-REVOKED",
        status: "void",
        createdAt: new Date(),
      },
    ]);
    expect(
      (await checkin.checkIn(door, { eventId: event.id, ticketCode: "TIX-REVOKED", clientOpId: "r" })).status,
    ).toBe("revoked");
    expect(
      (await checkin.checkIn(door, { eventId: event.id, email: "missing@example.com", clientOpId: "n" })).status,
    ).toBe("not_on_list");
    await checkin.revokePass(door, guest.id);
    expect(
      (
        await checkin.checkIn(door, {
          eventId: event.id,
          token: snapshot.guests[0]!.qrToken,
          clientOpId: "revoked-pass",
        })
      ).status,
    ).toBe("revoked");
  });

  it("syncs offline check-ins idempotently and keeps the first device on conflict", async () => {
    const { event, register, checkin } = await setup();
    await register.register({ eventId: event.id, email: "ada@example.com" });
    const snapshot = await checkin.manifest(door, event.id);
    const guest = snapshot.guests[0]!;
    const first = await checkin.sync(door, {
      eventId: event.id,
      deviceId: "phone-a",
      checkIns: [
        {
          clientOpId: "offline-1",
          registrationId: guest.registrationId,
          checkedInAt: "2026-11-01T18:01:00.000Z",
        },
      ],
    });
    const conflict = await checkin.sync(door, {
      eventId: event.id,
      deviceId: "phone-b",
      checkIns: [
        {
          clientOpId: "offline-2",
          registrationId: guest.registrationId,
          checkedInAt: "2026-11-01T18:05:00.000Z",
        },
        {
          clientOpId: "offline-1",
          registrationId: guest.registrationId,
          checkedInAt: "2026-11-01T18:01:00.000Z",
        },
      ],
    });
    expect(first.results[0]?.status).toBe("checked_in");
    expect(conflict.results[0]?.status).toBe("already_checked_in");
    expect(conflict.results[1]?.status).toBe("already_checked_in");
    expect(conflict.manifest.checkedIn).toBe(1);
  });

  it("searches by name, email and ticket id, and supports bulk check-in", async () => {
    const { event, register, checkin, issuedTickets } = await setup();
    const ada = await register.register({ eventId: event.id, email: "ada@example.com" });
    await register.register({ eventId: event.id, email: "al@example.com" });
    await issuedTickets.createMany([
      {
        id: "tix_ada",
        organizationId: "org_1",
        eventId: event.id,
        orderId: "ord_ada",
        registrationId: ada.id,
        ticketTypeId: null,
        code: "TIX-ADA",
        status: "valid",
        createdAt: new Date(),
      },
    ]);
    const byEmail = await checkin.search(door, event.id, "ada@");
    const byTicket = await checkin.search(door, event.id, "TIX-ADA");
    expect(byEmail.map((item) => item.email)).toEqual(["ada@example.com"]);
    expect(byTicket[0]?.ticketCode).toBe("TIX-ADA");
    const bulk = await checkin.checkAllIn(door, event.id);
    expect(bulk.every((item) => item.status === "checked_in" || item.status === "already_checked_in")).toBe(true);
    expect((await checkin.counter(door, event.id)).checkedIn).toBe(2);
  });

  it("creates a free walk-in and uses checkout for a paid event", async () => {
    const { event, checkin, tickets } = await setup();
    const walk = await checkin.walkIn(door, { eventId: event.id, email: "walk@example.com" });
    expect(walk.kind).toBe("free");
    if (walk.kind === "free") expect(walk.checkIn.status).toBe("checked_in");
    void tickets;

    const { event: paidEvent, checkin: paidCheckin } = await setupPaid();
    await expect(
      paidCheckin.walkIn(door, {
        eventId: paidEvent.id,
        email: "pay@example.com",
        ticketTypeId: "ga",
      }),
    ).rejects.toBeInstanceOf(PaymentNotConfiguredError);
  });

  it("alerts at capacity thresholds and isolates tenants plus dashboard RBAC", async () => {
    const { event, register, checkin, alerts } = await setup();
    await register.register({ eventId: event.id, email: "one@example.com" });
    await register.register({ eventId: event.id, email: "two@example.com" });
    await checkin.checkAllIn(door, event.id);
    expect(alerts.map((item) => item.threshold)).toEqual([50, 80, 100]);
    await expect(checkin.manifest(outsider, event.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(canAccessFullDashboard("check_in_manager")).toBe(false);
    expect(canAccessFullDashboard("owner")).toBe(true);
    expect(canAccessFullDashboard("finance")).toBe(true);
    expect(canAccessFullDashboard("read_only")).toBe(true);
  });
});

async function setupPaid() {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const registrations = createMemoryRegistrations();
  const tickets = createMemoryTickets();
  const register = createRegistrationService({
    events,
    registrations,
    tickets,
    coupons: createMemoryCoupons(),
    addOns: createMemoryAddOns(),
    orders: createMemoryOrders(),
  });
  const calendar = await createCalendarService({ calendars }).createCalendar(owner, { name: "Paid door" });
  const eventService = createEventService({ events, calendars, registrations: register });
  const event = await eventService.createEvent(owner, {
    calendarId: calendar.id,
    title: "Paid night",
    startsAt: new Date("2026-11-01T18:00:00.000Z"),
    endsAt: new Date("2026-11-01T21:00:00.000Z"),
    status: "published",
    isPaid: true,
  });
  await tickets.create({
    id: "ga",
    organizationId: "org_1",
    eventId: event.id,
    name: "GA",
    description: null,
    priceCents: 1500,
    currency: "EUR",
    capacity: null,
    salesStart: null,
    salesEnd: null,
    visibility: "public",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const checkin = createCheckInService({
    events,
    registrations,
    tickets,
    passes: memoryCheckInPasses(),
    records: memoryCheckInRecords(),
    alerts: memoryCapacityAlerts(),
    secret: "check-in-test-secret-32-characters!!",
    registrationsService: register,
  });
  return { event, checkin };
}
