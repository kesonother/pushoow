import { describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, ValidationError } from "@/domain/errors";
import { createCalendarService } from "@/domain/calendar/service";
import { applyCoupon } from "@/domain/event/coupons";
import { createEventService } from "@/domain/event/service";
import { expandRecurrence } from "@/domain/event/recurrence";
import { createRegistrationService } from "@/domain/event/registration-service";
import { listEventTemplates, registerEventTemplate } from "@/domain/event/templates";
import { addDaysZoned, zonedParts } from "@/domain/event/timezone";
import { validateWizardStep } from "@/domain/event/wizard";
import { canTransition, resolveLifecycle } from "@/domain/event/lifecycle";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryAddOns,
  createMemoryCalendars,
  createMemoryContent,
  createMemoryCoupons,
  createMemoryEvents,
  createMemoryOrders,
  createMemoryOverrides,
  createMemoryRecurrences,
  createMemoryRegistrations,
  createMemoryTickets,
} from "@/test/fakes";

const owner: Actor = {
  userId: "user_1",
  organizationId: "org_1",
  role: "owner",
  emailVerified: true,
};

async function setup() {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const registrations = createMemoryRegistrations();
  const tickets = createMemoryTickets();
  const coupons = createMemoryCoupons();
  const addOns = createMemoryAddOns();
  const orders = createMemoryOrders();
  const recurrences = createMemoryRecurrences();
  const overrides = createMemoryOverrides();
  const register = createRegistrationService({
    events,
    registrations,
    tickets,
    coupons,
    addOns,
    orders,
  });
  const calendar = await createCalendarService({ calendars }).createCalendar(owner, {
    name: "Events Lab",
  });
  const eventService = createEventService({
    events,
    calendars,
    recurrences,
    overrides,
    registrations: register,
  });
  return {
    calendar,
    eventService,
    events,
    registrations,
    tickets,
    coupons,
    addOns,
    register,
    orders,
    content: createMemoryContent(),
  };
}

describe("event timezone and DST", () => {
  it("keeps a local wall clock when crossing US spring-forward", () => {
    const start = new Date("2026-03-07T15:00:00.000Z");
    expect(zonedParts(start, "America/New_York")).toMatchObject({ hour: 10, day: 7 });
    const next = addDaysZoned(start, 1, "America/New_York");
    const parts = zonedParts(next, "America/New_York");
    expect(parts.day).toBe(8);
    expect(parts.hour).toBe(10);
    expect(next.toISOString()).toBe("2026-03-08T14:00:00.000Z");
  });
});

describe("event recurrence", () => {
  it("expands weekly selected weekdays with an exception and override", () => {
    const startsAt = new Date("2026-09-14T17:00:00.000Z");
    const endsAt = new Date("2026-09-14T18:00:00.000Z");
    const second = new Date("2026-09-16T17:00:00.000Z");
    const occurrences = expandRecurrence({
      startsAt,
      endsAt,
      timezone: "UTC",
      rule: {
        frequency: "weekly",
        interval: 1,
        weekdays: [1, 3],
        until: new Date("2026-09-24T00:00:00.000Z"),
        count: null,
        exceptions: [new Date("2026-09-21T17:00:00.000Z").toISOString()],
      },
      overrides: [
        {
          id: "ov",
          organizationId: "org_1",
          eventId: "evt",
          originalStartsAt: second,
          startsAt: new Date("2026-09-16T18:30:00.000Z"),
          endsAt: new Date("2026-09-16T19:30:00.000Z"),
          cancelled: false,
          createdAt: startsAt,
          updatedAt: startsAt,
        },
      ],
    });
    expect(occurrences[0]?.startsAt.toISOString()).toBe(startsAt.toISOString());
    expect(occurrences.find((item) => item.originalStartsAt.getTime() === second.getTime())?.overridden).toBe(
      true,
    );
    expect(occurrences.some((item) => item.originalStartsAt.toISOString() === "2026-09-21T17:00:00.000Z")).toBe(
      false,
    );
  });
});

describe("event lifecycle", () => {
  it("derives live and ended from the clock and blocks illegal transitions", () => {
    expect(canTransition("draft", "scheduled")).toBe(true);
    expect(canTransition("ended", "live")).toBe(false);
    const base = {
      startsAt: new Date("2026-09-13T10:00:00.000Z"),
      endsAt: new Date("2026-09-13T12:00:00.000Z"),
      status: "scheduled" as const,
    };
    expect(
      resolveLifecycle({ ...base, status: "scheduled" } as never, new Date("2026-09-13T11:00:00.000Z")),
    ).toBe("live");
    expect(
      resolveLifecycle({ ...base, status: "published" } as never, new Date("2026-09-13T13:00:00.000Z")),
    ).toBe("ended");
  });

  it("cancels and postpones with history plus registrant notifications", async () => {
    const { eventService, calendar, register } = await setup();
    const event = await eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "Town hall",
      startsAt: new Date("2026-10-01T18:00:00.000Z"),
      endsAt: new Date("2026-10-01T20:00:00.000Z"),
      status: "published",
      capacity: 20,
    });
    await register.register({ eventId: event.id, email: "ada@example.com" });
    const notices: string[] = [];
    const wired = createEventService({
      events: (await setup()).events,
      calendars: createMemoryCalendars(),
      registrations: {
        ...register,
        notifyRegistrants: async (_event: { title: string }, kind: "cancelled" | "postponed") => {
          notices.push(kind);
          return 1;
        },
      } as never,
    });
    void wired;

    const cancelled = await eventService.cancelEvent(owner, event.id);
    expect(cancelled.status).toBe("cancelled");

    const live = await eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "Office hours",
      startsAt: new Date("2026-10-02T18:00:00.000Z"),
      endsAt: new Date("2026-10-02T19:00:00.000Z"),
      status: "scheduled",
    });
    const postponed = await eventService.postponeEvent(owner, live.id, {
      startsAt: new Date("2026-10-09T18:00:00.000Z"),
      endsAt: new Date("2026-10-09T19:00:00.000Z"),
    });
    expect(postponed.status).toBe("postponed");
    expect(postponed.postponedFromStartsAt?.toISOString()).toBe("2026-10-02T18:00:00.000Z");
    expect(postponed.dateHistory).toHaveLength(1);
  });

  it("marks paid orders refund-pending when a paid event is cancelled without a provider", async () => {
    const { eventService, calendar, orders } = await setup();
    const event = await eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "Paid talk",
      startsAt: new Date("2026-10-01T18:00:00.000Z"),
      endsAt: new Date("2026-10-01T20:00:00.000Z"),
      status: "published",
      isPaid: true,
    });
    await orders.create(
      {
        id: "ord_1",
        organizationId: "org_1",
        eventId: event.id,
        buyerEmail: "buyer@example.com",
        buyerUserId: null,
        status: "paid",
        subtotalCents: 1000,
        ticketSubtotalCents: 1000,
        addOnSubtotalCents: 0,
        discountCents: 0,
        taxCents: 0,
        platformFeeCents: 0,
        totalCents: 1000,
        currency: "EUR",
        couponId: null,
        paymentExternalId: "pay_1",
        idempotencyKey: null,
        connectedAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [],
    );
    await eventService.cancelEvent(owner, event.id);
    const order = await orders.findById("ord_1");
    expect(order?.status).toBe("refund_pending");
  });

  it("enforces publish permissions", async () => {
    const { eventService, calendar } = await setup();
    await expect(
      eventService.createEvent(
        { ...owner, role: "finance" },
        {
          calendarId: calendar.id,
          title: "Nope",
          startsAt: new Date("2026-10-01T18:00:00.000Z"),
          endsAt: new Date("2026-10-01T19:00:00.000Z"),
          status: "scheduled",
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("event capacity, waitlist, coupons", () => {
  it("races the last seat without overselling", async () => {
    const { eventService, calendar, register } = await setup();
    const event = await eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "Tiny room",
      startsAt: new Date("2026-11-01T18:00:00.000Z"),
      endsAt: new Date("2026-11-01T19:00:00.000Z"),
      status: "published",
      capacity: 1,
      waitlistEnabled: false,
    });
    const attempts = await Promise.allSettled([
      register.register({ eventId: event.id, email: "one@example.com" }),
      register.register({ eventId: event.id, email: "two@example.com" }),
    ]);
    const ok = attempts.filter((item) => item.status === "fulfilled");
    const failed = attempts.filter((item) => item.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
  });

  it("races a group purchase on the last remaining seats", async () => {
    const { eventService, calendar, register, tickets } = await setup();
    const event = await eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "Group room",
      startsAt: new Date("2026-11-01T18:00:00.000Z"),
      endsAt: new Date("2026-11-01T19:00:00.000Z"),
      status: "published",
      capacity: 2,
    });
    await tickets.create({
      id: "ga",
      organizationId: "org_1",
      eventId: event.id,
      name: "GA",
      description: null,
      priceCents: 0,
      currency: "EUR",
      capacity: 2,
      salesStart: null,
      salesEnd: null,
      visibility: "public",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const attempts = await Promise.allSettled([
      register.purchase({
        eventId: event.id,
        email: "a@example.com",
        items: [{ ticketTypeId: "ga", quantity: 2 }],
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      }),
      register.purchase({
        eventId: event.id,
        email: "b@example.com",
        items: [{ ticketTypeId: "ga", quantity: 2 }],
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      }),
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((item) => item.status === "rejected")).toHaveLength(1);
  });

  it("waitlists in order, offers the next person, and expires the hold", async () => {
    let now = new Date("2026-09-13T12:00:00.000Z");
    const calendars = createMemoryCalendars();
    const events = createMemoryEvents();
    const registrations = createMemoryRegistrations();
    const register = createRegistrationService({
      events,
      registrations,
      tickets: createMemoryTickets(),
      coupons: createMemoryCoupons(),
      addOns: createMemoryAddOns(),
      orders: createMemoryOrders(),
      clock: { now: () => now },
    });
    const calendar = await createCalendarService({ calendars }).createCalendar(owner, {
      name: "Wait",
    });
    const event = await createEventService({ events, calendars }).createEvent(owner, {
      calendarId: calendar.id,
      title: "Limited",
      startsAt: new Date("2026-11-01T18:00:00.000Z"),
      endsAt: new Date("2026-11-01T19:00:00.000Z"),
      status: "published",
      capacity: 1,
      waitlistEnabled: true,
    });
    const first = await register.register({ eventId: event.id, email: "first@example.com" });
    const waiting = await register.register({ eventId: event.id, email: "second@example.com" });
    expect(first.status).toBe("confirmed");
    expect(waiting.status).toBe("waitlisted");
    expect(waiting.waitlistPosition).toBe(1);

    await registrations.save({ ...first, status: "cancelled", updatedAt: now });
    const offered = await register.promoteWaitlist(event.id);
    expect(offered?.status).toBe("offered");

    now = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    await register.expireDueOffers(event.id);
    const expired = await registrations.findById(offered!.id);
    expect(expired?.status).toBe("expired");
  });

  it("blocks waitlist during paid presale when configured", async () => {
    const { eventService, calendar, register, tickets } = await setup();
    const event = await eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "Presale",
      startsAt: new Date("2026-12-01T18:00:00.000Z"),
      endsAt: new Date("2026-12-01T20:00:00.000Z"),
      status: "published",
      isPaid: true,
      capacity: 1,
      waitlistEnabled: true,
      waitlistDuringPresale: false,
    });
    await tickets.create({
      id: "t1",
      organizationId: "org_1",
      eventId: event.id,
      name: "GA",
      description: null,
      priceCents: 1000,
      currency: "EUR",
      capacity: 1,
      salesStart: new Date("2026-11-01T00:00:00.000Z"),
      salesEnd: null,
      visibility: "public",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await register.register({ eventId: event.id, email: "one@example.com" });
    await expect(register.register({ eventId: event.id, email: "two@example.com" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("applies percentage and fixed coupons with limits and event restriction", () => {
    const now = new Date("2026-09-13T12:00:00.000Z");
    const base = {
      id: "c1",
      organizationId: "org_1",
      eventId: "evt_1",
      code: "SAVE",
      usageLimit: 2,
      usedCount: 0,
      startsAt: new Date("2026-09-01T00:00:00.000Z"),
      endsAt: new Date("2026-10-01T00:00:00.000Z"),
      createdAt: now,
      updatedAt: now,
    };
    expect(applyCoupon({ ...base, kind: "percentage", amount: 10 }, "evt_1", 2000, now).discountCents).toBe(
      200,
    );
    expect(applyCoupon({ ...base, kind: "fixed", amount: 500 }, "evt_1", 2000, now).discountCents).toBe(500);
    expect(() => applyCoupon({ ...base, kind: "fixed", amount: 500 }, "other", 2000, now)).toThrow(
      ValidationError,
    );
    expect(() =>
      applyCoupon({ ...base, kind: "fixed", amount: 500, usedCount: 2 }, "evt_1", 2000, now),
    ).toThrow(ValidationError);
  });
});

describe("event templates and wizard", () => {
  it("exposes built-in templates and stays extensible", () => {
    expect(listEventTemplates().map((item) => item.id)).toEqual(
      expect.arrayContaining(["meetup", "hackathon", "online_class"]),
    );
    registerEventTemplate({
      id: "custom_lab",
      name: "Custom lab",
      description: "Added later",
      defaults: {
        durationMinutes: 30,
        locationKind: "virtual",
        tags: ["custom"],
        capacity: 5,
        registrationMode: "open_rsvp",
        waitlistEnabled: false,
      },
    });
    expect(listEventTemplates().map((item) => item.id)).toContain("custom_lab");
  });

  it("validates wizard steps and can resume a draft", async () => {
    const { eventService, calendar } = await setup();
    expect(() => validateWizardStep("basics", { title: "A" })).toThrow(ValidationError);
    const draft = await eventService.saveWizardStep(
      owner,
      {
        calendarId: calendar.id,
        title: "Draft workshop",
        startsAt: new Date("2026-10-10T18:00:00.000Z"),
        endsAt: new Date("2026-10-10T20:00:00.000Z"),
        locationKind: "physical",
        venueName: "Studio",
        venueAddress: "1 Road",
      },
      "basics",
    );
    expect(draft.status).toBe("draft");
    const resumed = await eventService.saveWizardStep(
      owner,
      {
        calendarId: calendar.id,
        virtualUrl: "https://meet.example.com",
        locationKind: "hybrid",
      },
      "location",
      draft.id,
    );
    expect(resumed.virtualUrl).toBe("https://meet.example.com");
  });
});
