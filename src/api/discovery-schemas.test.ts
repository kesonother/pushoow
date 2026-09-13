import { describe, expect, it } from "vitest";
import { compactSearchParams, discoverQuerySchema, filtersFromQuery } from "@/api/discovery-schemas";
import { publicDiscoveryCard } from "@/api/discovery-view";
import type { DiscoveryEventCard } from "@/domain/discovery/types";
import { eventDefaults } from "@/domain/event/types";

describe("discover query schema", () => {
  it("parses date presets and compact empty params", () => {
    const query = discoverQuerySchema.parse(
      compactSearchParams(new URLSearchParams("q=rust&city=&format=online&date=this_week")),
    );
    expect(query.city).toBeUndefined();
    expect(query.format).toBe("online");
    const filters = filtersFromQuery(query, new Date("2026-09-13T12:00:00.000Z"));
    expect(filters.dateFrom?.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(filters.dateTo?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("strips secrets from public discovery cards", () => {
    const card = {
      event: {
        ...eventDefaults(),
        id: "evt_1",
        organizationId: "org_1",
        calendarId: "cal_1",
        slug: "secret-meetup",
        title: "Secret Meetup",
        description: "Hello",
        startsAt: new Date("2026-10-01T18:00:00.000Z"),
        endsAt: new Date("2026-10-01T20:00:00.000Z"),
        timezone: "Europe/Paris",
        status: "scheduled",
        visibility: "public",
        isPaid: false,
        isFeatured: false,
        tags: ["ai"],
        venueName: null,
        venueAddress: null,
        registrationPasswordHash: "hash",
        accessToken: "token",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        deletedAt: null,
      },
      calendarId: "cal_1",
      calendarName: "AI Club",
      calendarSlug: "ai-club",
      organizerName: "Ada",
      format: "in-person",
      minPriceCents: 0,
      trendingScore: 4,
    } satisfies DiscoveryEventCard;
    const published = publicDiscoveryCard(card);
    expect(published.event.title).toBe("Secret Meetup");
    expect(published).not.toHaveProperty("event.registrationPasswordHash");
    expect("registrationPasswordHash" in published.event).toBe(false);
    expect("accessToken" in published.event).toBe(false);
  });
});
