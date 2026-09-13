import { describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/domain/errors";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import type { Actor } from "@/domain/rbac/permissions";
import { createMemoryCalendars, createMemoryEvents } from "@/test/fakes";

const owner: Actor = {
  userId: "user_1",
  organizationId: "org_1",
  role: "owner",
};

async function setup() {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const calendarService = createCalendarService({ calendars });
  const eventService = createEventService({ events, calendars });
  const calendar = await calendarService.createCalendar(owner, { name: "Tech" });
  return { eventService, calendar };
}

describe("event service", () => {
  it("creates a draft event on a tenant calendar", async () => {
    const { eventService, calendar } = await setup();
    const event = await eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "Launch night",
      startsAt: new Date("2026-10-01T18:00:00.000Z"),
      endsAt: new Date("2026-10-01T21:00:00.000Z"),
    });

    expect(event.organizationId).toBe("org_1");
    expect(event.calendarId).toBe(calendar.id);
    expect(event.status).toBe("draft");
  });

  it("rejects inverted date windows", async () => {
    const { eventService, calendar } = await setup();
    await expect(
      eventService.createEvent(owner, {
        calendarId: calendar.id,
        title: "Broken",
        startsAt: new Date("2026-10-02T18:00:00.000Z"),
        endsAt: new Date("2026-10-01T21:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("prevents finance from publishing events", async () => {
    const { eventService, calendar } = await setup();
    await expect(
      eventService.createEvent(
        { ...owner, role: "finance" },
        {
          calendarId: calendar.id,
          title: "Paid talk",
          startsAt: new Date("2026-10-01T18:00:00.000Z"),
          endsAt: new Date("2026-10-01T21:00:00.000Z"),
          status: "published",
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows publishing a free event without email verification", async () => {
    const { eventService, calendar } = await setup();
    const event = await eventService.createEvent(
      { ...owner, emailVerified: false },
      {
        calendarId: calendar.id,
        title: "Community AMA",
        startsAt: new Date("2026-10-01T18:00:00.000Z"),
        endsAt: new Date("2026-10-01T21:00:00.000Z"),
        status: "published",
        isPaid: false,
      },
    );
    expect(event.status).toBe("published");
  });

  it("requires a verified email before publishing a paid event", async () => {
    const { eventService, calendar } = await setup();
    await expect(
      eventService.createEvent(
        { ...owner, emailVerified: false },
        {
          calendarId: calendar.id,
          title: "Paid workshop",
          startsAt: new Date("2026-10-01T18:00:00.000Z"),
          endsAt: new Date("2026-10-01T21:00:00.000Z"),
          status: "published",
          isPaid: true,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks creating an event on another tenant calendar", async () => {
    const { eventService, calendar } = await setup();
    await expect(
      eventService.createEvent(
        { userId: "user_2", organizationId: "org_2", role: "owner" },
        {
          calendarId: calendar.id,
          title: "Hostile takeover",
          startsAt: new Date("2026-10-01T18:00:00.000Z"),
          endsAt: new Date("2026-10-01T21:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
