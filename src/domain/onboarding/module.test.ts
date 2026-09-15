import { afterEach, describe, expect, it } from "vitest";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import { resetMetrics } from "@/observability/metrics";
import type { Actor } from "@/domain/rbac/permissions";
import { createMemoryCalendars, createMemoryEvents, createMemoryFollowers, createMemoryRegistrations } from "@/test/fakes";
import { activationSnapshot, resetActivation, trackActivation } from "./activation";
import { emptyState, EMPTY_STATES } from "./empty-states";
import { LIFECYCLE_SERIES } from "./lifecycle";
import { createOnboardingService } from "./service";
import { applyCalendarTemplate, firstMeetupPrefill, MEETUP_CALENDAR_TEMPLATE } from "./templates";

const owner: Actor = { userId: "user_1", organizationId: "org_1", role: "owner" };

afterEach(() => {
  resetActivation();
  resetMetrics();
});

describe("organizer templates", () => {
  it("pre-fills a Meetup calendar and a First Meetup event", () => {
    const calendar = applyCalendarTemplate({ name: "Paris Crew", templateId: "meetup" });
    expect(calendar.description).toContain("Meetup");
    expect(calendar.tags).toEqual(MEETUP_CALENDAR_TEMPLATE.defaults.tags);
    expect(calendar.visibility).toBe("public");

    const event = firstMeetupPrefill(new Date("2026-09-15T10:00:00.000Z"));
    expect(event.templateId).toBe("first_meetup");
    expect(event.title).toBe("First Meetup");
    expect(event.endsAt.getTime() - event.startsAt.getTime()).toBe(120 * 60_000);
    expect(event.startsAt.toISOString()).toBe("2026-09-22T18:30:00.000Z");
  });
});

describe("activation tracking", () => {
  it("records signup and first_* events only once", () => {
    expect(trackActivation({ userId: "user_1", name: "signup" })).toBe(true);
    expect(trackActivation({ userId: "user_1", name: "signup" })).toBe(false);
    expect(trackActivation({ userId: "user_1", name: "first_rsvp" })).toBe(true);
    expect(trackActivation({ userId: "user_1", name: "first_rsvp" })).toBe(false);
    expect(trackActivation({ userId: "user_1", name: "calendar_created" })).toBe(true);
    expect(trackActivation({ userId: "user_1", name: "calendar_created" })).toBe(true);
    expect(activationSnapshot().counts.signup).toBe(1);
    expect(activationSnapshot().counts.first_rsvp).toBe(1);
    expect(activationSnapshot().counts.calendar_created).toBe(2);
  });
});

describe("onboarding progress and lifecycle", () => {
  it("walks the organizer and attendee checklists and schedules lifecycle emails", async () => {
    const calendars = createMemoryCalendars();
    const events = createMemoryEvents();
    const registrations = createMemoryRegistrations();
    const followers = createMemoryFollowers();
    const scheduled: Array<{ key: string; at: Date }> = [];
    const onboarding = createOnboardingService({
      calendars,
      events,
      registrations,
      followers,
      organizationIdsForUser: async () => [owner.organizationId],
      clock: { now: () => new Date("2026-09-15T12:00:00.000Z") },
      scheduleLifecycle: async (input) => {
        scheduled.push({ key: input.key, at: input.availableAt });
      },
    });

    const keys = await onboarding.startForNewUser({ userId: owner.userId, email: "ada@example.com" });
    expect(keys).toEqual(LIFECYCLE_SERIES.map((item) => item.key));
    expect(scheduled).toHaveLength(LIFECYCLE_SERIES.length);
    expect(scheduled[0]?.key).toBe("welcome_day0");
    expect(scheduled.find((item) => item.key === "reengagement_inactive")?.at.toISOString()).toBe(
      "2026-10-06T12:00:00.000Z",
    );

    let organizer = await onboarding.organizerProgress({ userId: owner.userId, organizationId: owner.organizationId });
    expect(organizer.next?.id).toBe("calendar_created");
    expect(await onboarding.shouldSend(owner.userId, "welcome_create_calendar", owner.organizationId)).toBe(true);

    const calendarService = createCalendarService({ calendars });
    const calendar = await calendarService.createCalendar(owner, applyCalendarTemplate({ name: "Crew", templateId: "meetup" }));
    await onboarding.track({ userId: owner.userId, name: "calendar_created", organizationId: owner.organizationId });
    organizer = await onboarding.organizerProgress({ userId: owner.userId, organizationId: owner.organizationId });
    expect(organizer.steps.find((step) => step.id === "calendar_created")?.complete).toBe(true);
    expect(organizer.next?.id).toBe("event_created");
    expect(await onboarding.shouldSend(owner.userId, "welcome_create_calendar", owner.organizationId)).toBe(false);
    expect(await onboarding.shouldSend(owner.userId, "welcome_create_calendar")).toBe(false);

    const eventService = createEventService({ events, calendars });
    const starter = firstMeetupPrefill(new Date("2026-09-15T10:00:00.000Z"));
    const event = await eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: starter.title,
      description: starter.description,
      startsAt: starter.startsAt,
      endsAt: starter.endsAt,
      templateId: "meetup",
      status: "draft",
    });
    await onboarding.track({ userId: owner.userId, name: "event_created", organizationId: owner.organizationId });
    organizer = await onboarding.organizerProgress({ userId: owner.userId, organizationId: owner.organizationId });
    expect(organizer.next?.id).toBe("event_published");

    await eventService.updateEvent(owner, event.id, { status: "published" });
    await onboarding.track({ userId: owner.userId, name: "event_published", organizationId: owner.organizationId });
    organizer = await onboarding.organizerProgress({ userId: owner.userId, organizationId: owner.organizationId });
    expect(organizer.next?.id).toBe("share");
    expect(organizer.next?.href).toContain("onboarding=share");
    expect(organizer.complete).toBe(false);
    expect(await onboarding.shouldSend(owner.userId, "reengagement_inactive", owner.organizationId)).toBe(false);

    await onboarding.track({ userId: owner.userId, name: "share" });
    organizer = await onboarding.organizerProgress({ userId: owner.userId, organizationId: owner.organizationId });
    expect(organizer.complete).toBe(true);

    let attendee = await onboarding.attendeeProgress("guest_1");
    expect(attendee.next?.id).toBe("first_event");
    await onboarding.track({ userId: "guest_1", name: "first_event" });
    await followers.create({
      id: "fol_1",
      organizationId: owner.organizationId,
      calendarId: calendar.id,
      userId: "guest_1",
      preferences: { email: true, push: false, sms: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await onboarding.track({ userId: "guest_1", name: "first_follow" });
    await registrations.create({
      id: "reg_1",
      organizationId: owner.organizationId,
      calendarId: calendar.id,
      eventId: event.id,
      userId: "guest_1",
      email: "guest@example.com",
      status: "confirmed",
      occurrenceStartsAt: null,
      orderId: null,
      ticketTypeId: null,
      quantity: 1,
      offeredUntil: null,
      waitlistPosition: null,
      anonymous: false,
      appearOnRoster: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await onboarding.track({ userId: "guest_1", name: "first_rsvp" });
    attendee = await onboarding.attendeeProgress("guest_1");
    expect(attendee.complete).toBe(true);
  });
});

describe("empty states", () => {
  it("gives every empty screen a useful action", () => {
    expect(EMPTY_STATES).toHaveLength(9);
    expect(emptyState("me_events").href).toBe("/discover");
    expect(emptyState("me_calendars").href).toBe("/discover");
    expect(emptyState("dashboard_events", { organizationId: "org_1", calendarId: "cal_1" }).href).toContain(
      "first_meetup",
    );
    expect(emptyState("dashboard_calendars", { organizationId: "org_1" }).href).toContain("template=meetup");
  });
});
