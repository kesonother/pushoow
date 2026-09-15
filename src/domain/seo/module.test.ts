import { describe, expect, it } from "vitest";
import { eventDefaults } from "@/domain/event/types";
import { defaultCalendarBranding } from "@/domain/calendar/types";
import { createMemoryCalendars, createMemoryEvents } from "@/test/fakes";
import { isIndexableCalendar, isIndexableEvent } from "./indexability";
import { eventJsonLd, serializeJsonLd } from "./schema";
import { buildSitemap } from "./sitemap";
import { robotsDocument } from "./robots";
import { eventPageMetadata, calendarPageMetadata } from "./metadata";
import { createSeoService } from "./service";

const now = new Date("2026-09-15T12:00:00.000Z");

function calendar(overrides: Partial<Parameters<typeof Object.assign>[0]> = {}) {
  return {
    id: "cal_1",
    organizationId: "org_1",
    slug: "crew",
    name: "Crew",
    description: "Community calendar",
    timezone: "UTC",
    locale: "en",
    defaultCurrency: "EUR",
    visibility: "public" as const,
    tags: ["meetup"],
    bannedWords: [],
    feedToken: "feed",
    ...defaultCalendarBranding(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    organizationId: "org_1",
    calendarId: "cal_1",
    slug: "first-meetup",
    title: "First Meetup",
    description: "Hello <script>alert(1)</script>",
    startsAt: new Date("2026-09-22T18:30:00.000Z"),
    endsAt: new Date("2026-09-22T20:30:00.000Z"),
    timezone: "UTC",
    status: "published" as const,
    visibility: "public" as const,
    isPaid: false,
    isFeatured: false,
    tags: ["meetup"],
    venueName: "Studio",
    venueAddress: "1 Rue Demo",
    ...eventDefaults(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("indexability", () => {
  it("keeps private, unlisted, draft, and auth surfaces out of the index", () => {
    expect(isIndexableCalendar(calendar({ visibility: "private" }))).toBe(false);
    expect(isIndexableCalendar(calendar({ visibility: "unlisted" }))).toBe(false);
    expect(isIndexableEvent(event({ visibility: "private" }), calendar())).toBe(false);
    expect(isIndexableEvent(event({ status: "draft" }), calendar())).toBe(false);
    expect(isIndexableEvent(event(), calendar({ visibility: "private" }))).toBe(false);
    expect(isIndexableEvent(event())).toBe(false);
    expect(isIndexableEvent(event(), calendar())).toBe(true);
  });
});

describe("structured data and metadata", () => {
  it("emits Schema.org Event JSON-LD and social cards", () => {
    const jsonLd = eventJsonLd({ event: event(), calendarName: "Crew", origin: "https://pushoow.test" });
    expect(jsonLd["@type"]).toBe("Event");
    expect(jsonLd.url).toBe("https://pushoow.test/e/first-meetup");
    expect(jsonLd.eventAttendanceMode).toContain("OfflineEventAttendanceMode");
    expect(serializeJsonLd(jsonLd)).not.toContain("<script>");
    expect(serializeJsonLd(jsonLd)).toContain("\\u003cscript");

    const meta = eventPageMetadata(event({ visibility: "unlisted" }));
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.twitter && "card" in meta.twitter ? meta.twitter.card : undefined).toBe("summary");
    expect(calendarPageMetadata(calendar()).alternates?.canonical).toBe("/c/crew");
  });
});

describe("sitemap and robots", () => {
  it("lists only public calendars and events plus marketing pages", async () => {
    const calendars = createMemoryCalendars();
    const events = createMemoryEvents();
    await calendars.create(calendar());
    await calendars.create(calendar({ id: "cal_priv", slug: "secret", visibility: "private" }));
    await events.create(event());
    await events.create(event({ id: "evt_draft", slug: "draft", status: "draft" }));
    await events.create(event({ id: "evt_priv", slug: "closed", visibility: "private" }));
    await events.create(event({ id: "evt_hidden_cal", slug: "hidden-cal", calendarId: "cal_priv" }));

    const sitemap = await buildSitemap({ events, calendars, origin: "https://pushoow.test" });
    const urls = sitemap.map((item) => item.url);
    expect(urls).toContain("https://pushoow.test/e/first-meetup");
    expect(urls).toContain("https://pushoow.test/c/crew");
    expect(urls).toContain("https://pushoow.test");
    expect(urls).toContain("https://pushoow.test/press");
    expect(urls).not.toContain("https://pushoow.test/e/draft");
    expect(urls).not.toContain("https://pushoow.test/e/hidden-cal");
    expect(urls).not.toContain("https://pushoow.test/c/secret");

    const robots = robotsDocument("https://pushoow.test");
    expect(robots.sitemap).toBe("https://pushoow.test/sitemap.xml");
    expect(robots.rules).toMatchObject({
      disallow: expect.arrayContaining(["/dashboard", "/me", "/embed", "/r/", "/login"]),
    });

    const seo = createSeoService({ events, calendars });
    expect(await seo.indexableEventSlugs()).toEqual(["first-meetup"]);
    expect(await seo.indexableCalendarSlugs()).toEqual(["crew"]);
  });
});
