import { describe, expect, it } from "vitest";
import { createCalendarService } from "@/domain/calendar/service";
import { createDiscoveryService } from "@/domain/discovery/service";
import { isFeaturedEligible, averageAttendance } from "@/domain/discovery/featured";
import { trendingScore } from "@/domain/discovery/score";
import { createEventService } from "@/domain/event/service";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryCalendars,
  createMemoryEvents,
  createMemoryFollowers,
  createMemoryRegistrations,
  createMemoryTickets,
} from "@/test/fakes";

const owner: Actor = {
  userId: "user_1",
  organizationId: "org_1",
  role: "owner",
  emailVerified: true,
};

const now = new Date("2026-09-13T18:00:00.000Z");

async function setup() {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const registrations = createMemoryRegistrations();
  const tickets = createMemoryTickets();
  const followers = createMemoryFollowers();
  const calendarSvc = createCalendarService({ calendars });
  const eventSvc = createEventService({ events, calendars });
  const discovery = createDiscoveryService({
    events,
    calendars,
    registrations,
    tickets,
    followers,
    clock: { now: () => now },
  });
  const calendar = await calendarSvc.createCalendar(owner, { name: "Paris Tech", tags: ["tech"] });
  return { calendar, calendarSvc, eventSvc, discovery, events, registrations, tickets, followers, calendars };
}

async function publish(
  eventSvc: ReturnType<typeof createEventService>,
  calendarId: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  return eventSvc.createEvent(owner, {
    calendarId,
    title,
    startsAt: new Date("2026-10-01T18:00:00.000Z"),
    endsAt: new Date("2026-10-01T20:00:00.000Z"),
    status: "published",
    visibility: "public",
    ...extra,
  });
}

describe("discovery marketplace", () => {
  it("lets a stranger filter, search and paginate public events", async () => {
    const { calendar, eventSvc, discovery } = await setup();
    await publish(eventSvc, calendar.id, "Paris AI Meetup", {
      city: "Paris",
      country: "FR",
      category: "meetup",
      language: "fr",
      tags: ["ai"],
      locationKind: "physical",
    });
    await publish(eventSvc, calendar.id, "Online Rust Class", {
      city: null,
      category: "class",
      language: "en",
      tags: ["rust"],
      locationKind: "virtual",
      isPaid: true,
    });
    const all = await discovery.discover({ limit: 20 });
    expect(all.items).toHaveLength(2);
    const paris = await discovery.discover({ city: "Paris", format: "in-person" });
    expect(paris.items).toHaveLength(1);
    expect(paris.items[0]?.event.title).toBe("Paris AI Meetup");
    const search = await discovery.discover({ q: "rust class" });
    expect(search.items.map((item) => item.event.title)).toEqual(["Online Rust Class"]);
    expect(search.facets.format.some((item) => item.value === "online")).toBe(true);
    const page = await discovery.discover({ limit: 1 });
    expect(page.nextCursor).toBeTruthy();
    const next = await discovery.discover({ limit: 1, cursor: page.nextCursor ?? undefined });
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.event.id).not.toBe(page.items[0]?.event.id);
  });

  it("computes a deterministic trending score from velocity and growth", () => {
    expect(
      trendingScore({
        recentRegs7d: 10,
        previousRegs7d: 4,
        velocity48h: 3,
        followerCount: 25,
        featured: true,
      }),
    ).toBe(10 * 3 + 6 * 2 + 3 * 4 + 2 + 5);
  });

  it("builds marketplace sections and map clusters with an unlocated fallback", async () => {
    const { calendar, eventSvc, discovery } = await setup();
    await publish(eventSvc, calendar.id, "Pinned", {
      isFeatured: true,
      latitude: 48.85,
      longitude: 2.35,
      city: "Paris",
      startsAt: new Date("2026-09-14T18:00:00.000Z"),
      endsAt: new Date("2026-09-14T20:00:00.000Z"),
    });
    await publish(eventSvc, calendar.id, "No coords", {
      startsAt: new Date("2026-10-10T18:00:00.000Z"),
      endsAt: new Date("2026-10-10T20:00:00.000Z"),
    });
    const sections = await discovery.sections();
    expect(sections.editorsPicks.map((item) => item.event.title)).toContain("Pinned");
    expect(sections.closingSoon.map((item) => item.event.title)).toContain("Pinned");
    expect(sections.newOnPlatform.length).toBeGreaterThan(0);
    const map = await discovery.map({});
    expect(map.clusters[0]?.count).toBe(1);
    expect(map.unlocated.map((item) => item.event.title)).toContain("No coords");
  });

  it("recommends similar events without machine learning", async () => {
    const { calendar, eventSvc, discovery, registrations } = await setup();
    const seed = await publish(eventSvc, calendar.id, "Seed AI", { tags: ["ai"], category: "meetup" });
    const similar = await publish(eventSvc, calendar.id, "More AI", { tags: ["ai"], category: "meetup" });
    await publish(eventSvc, calendar.id, "Cooking", { tags: ["food"], category: "dinner" });
    await registrations.create({
      id: "r1",
      organizationId: "org_1",
      calendarId: calendar.id,
      eventId: seed.id,
      userId: "viewer",
      email: "viewer@example.com",
      status: "confirmed",
      occurrenceStartsAt: null,
      orderId: null,
      ticketTypeId: null,
      quantity: 1,
      offeredUntil: null,
      waitlistPosition: null,
      createdAt: now,
      updatedAt: now,
    });
    const reco = await discovery.recommend({ userId: "viewer" });
    expect(reco[0]?.event.id).toBe(similar.id);
  });

  it("features a calendar only when eligibility is earned, never bought", async () => {
    expect(
      isFeaturedEligible({ publishedEventCount: 9, followerCount: 500, averageAttendance: 0.9 }),
    ).toBe(false);
    expect(
      isFeaturedEligible({ publishedEventCount: 10, followerCount: 100, averageAttendance: null }),
    ).toBe(true);
    expect(
      isFeaturedEligible({ publishedEventCount: 10, followerCount: 2, averageAttendance: 0.71 }),
    ).toBe(true);
    expect(averageAttendance([], new Map())).toBeNull();

    const { calendar, eventSvc, discovery, registrations } = await setup();
    const created = [];
    for (let index = 0; index < 10; index += 1) {
      created.push(
        await publish(eventSvc, calendar.id, `Talk ${index}`, {
          capacity: 10,
          startsAt: new Date(`2026-10-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`),
          endsAt: new Date(`2026-10-${String(index + 1).padStart(2, "0")}T20:00:00.000Z`),
        }),
      );
    }
    for (const event of created) {
      for (let seat = 0; seat < 8; seat += 1) {
        await registrations.create({
          id: `${event.id}-${seat}`,
          organizationId: "org_1",
          calendarId: calendar.id,
          eventId: event.id,
          userId: `u${seat}`,
          email: `u${seat}@example.com`,
          status: "confirmed",
          occurrenceStartsAt: null,
          orderId: null,
          ticketTypeId: null,
          quantity: 1,
          offeredUntil: null,
          waitlistPosition: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const featured = await discovery.featuredCalendars();
    expect(featured).toHaveLength(1);
    expect(featured[0]?.buyable).toBe(false);
    expect(featured[0]?.publishedEventCount).toBe(10);
  });

  it("prepares organizer discovery insights", async () => {
    const { calendar, calendarSvc, eventSvc, discovery } = await setup();
    const other = await calendarSvc.createCalendar(owner, { name: "AI Friends", tags: ["tech", "ai"] });
    await publish(eventSvc, calendar.id, "Own", { tags: ["tech"], city: "Paris" });
    await publish(eventSvc, other.id, "Partner", { tags: ["ai"], city: "Paris" });
    const insights = await discovery.insights(calendar.id);
    expect(insights?.similarCalendars.map((item) => item.slug)).toContain(other.slug);
    expect(insights?.partnerships.some((item) => item.id === other.id)).toBe(true);
    expect(insights?.tagSuggestions).toContain("ai");
  });
});
