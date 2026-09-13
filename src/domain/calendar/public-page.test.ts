import { describe, expect, it } from "vitest";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import { createFollowService } from "@/domain/calendar/follow-service";
import { createMembershipService } from "@/domain/calendar/membership-service";
import { createPublicCalendarService } from "@/domain/calendar/public-page";
import { createCalendarFeedService, renderIcs } from "@/domain/calendar/feeds";
import { createCalendarNotifyService } from "@/domain/calendar/notify";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryCalendarMembers,
  createMemoryCalendars,
  createMemoryEvents,
  createMemoryFollowers,
  createMemoryMembers,
  createMemorySubscriptions,
  createMemoryTiers,
} from "@/test/fakes";

const owner: Actor = {
  userId: "user_1",
  organizationId: "org_1",
  role: "owner",
  emailVerified: true,
};

function harness() {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const followers = createMemoryFollowers();
  const calendarMembers = createMemoryCalendarMembers();
  const orgMembers = createMemoryMembers();
  const tiers = createMemoryTiers();
  const subscriptions = createMemorySubscriptions();
  return {
    calendars,
    events,
    followers,
    calendarMembers,
    orgMembers,
    calendarService: createCalendarService({ calendars }),
    eventService: createEventService({ events, calendars }),
    follow: createFollowService({
      calendars,
      followers,
      subscriptions,
      calendarMembers,
      orgMembers,
    }),
    memberships: createMembershipService({ calendars, tiers, members: calendarMembers }),
    publicPage: createPublicCalendarService({
      calendars,
      events,
      followers,
      tiers,
      calendarMembers,
      orgMembers,
      clock: { now: () => new Date("2026-09-01T00:00:00.000Z") },
    }),
    feeds: createCalendarFeedService({ calendars, events }),
  };
}

describe("calendar public page and privacy", () => {
  it("groups upcoming events by month and lists featured items", async () => {
    const h = harness();
    const calendar = await h.calendarService.createCalendar(owner, {
      name: "AI Club",
      tags: ["ai"],
      postalAddress: "10 Rue de Rivoli, Paris",
    });
    await h.eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "September AMA",
      startsAt: new Date("2026-09-20T18:00:00.000Z"),
      endsAt: new Date("2026-09-20T20:00:00.000Z"),
      status: "published",
      isFeatured: true,
      tags: ["ama"],
    });
    await h.eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "October demo",
      startsAt: new Date("2026-10-05T18:00:00.000Z"),
      endsAt: new Date("2026-10-05T20:00:00.000Z"),
      status: "published",
    });

    const view = await h.publicPage.getView(calendar.slug);
    expect(view.access).toBe("full");
    if (view.access !== "full") return;
    expect(view.eventsByMonth).toHaveLength(2);
    expect(view.featured[0]?.title).toBe("September AMA");
    expect(view.tags).toEqual(expect.arrayContaining(["ai", "ama"]));
    expect(view.map.openStreetMapUrl).toContain("openstreetmap.org");
  });

  it("shows a join page for private calendars", async () => {
    const h = harness();
    const calendar = await h.calendarService.createCalendar(owner, {
      name: "Inner Circle",
      visibility: "private",
    });
    const view = await h.publicPage.getView(calendar.slug, "visitor");
    expect(view.access).toBe("join");
  });

  it("renders an iCal feed that reflects cancellations", async () => {
    const h = harness();
    const calendar = await h.calendarService.createCalendar(owner, { name: "Feed Club" });
    const event = await h.eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "Launch",
      startsAt: new Date("2026-11-01T18:00:00.000Z"),
      endsAt: new Date("2026-11-01T20:00:00.000Z"),
      status: "published",
    });
    await h.eventService.updateEvent(owner, event.id, { status: "cancelled" });
    const ics = renderIcs(calendar, await h.events.listByCalendar(calendar.id), "https://pushoow.test");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("LAST-MODIFIED");
    expect(ics).toContain("not a bidirectional");
  });

  it("notifies followers when a published event changes", async () => {
    const h = harness();
    const queued: string[] = [];
    const notify = createCalendarNotifyService({
      followers: h.followers,
      users: {
        async findById(id) {
          return { id, email: `${id}@example.com`, emailVerified: true };
        },
        async findByEmail() {
          return null;
        },
      },
      enqueue: async (job) => {
        queued.push(String(job.payload.to));
        return job;
      },
    });
    const calendar = await h.calendarService.createCalendar(owner, { name: "Ping" });
    await h.follow.follow("fan", calendar.id, { email: true });
    await notify.notifyEventChange({
      calendarId: calendar.id,
      eventId: "evt_1",
      change: "updated",
      title: "Talk",
      calendarName: calendar.name,
    });
    expect(queued).toEqual(["fan@example.com"]);
  });
});
