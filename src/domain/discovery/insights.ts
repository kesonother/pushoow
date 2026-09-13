import { isDiscoverable } from "@/domain/discovery/query";
import type { DiscoveryEventCard, OrganizerInsights } from "@/domain/discovery/types";
import type { Calendar } from "@/domain/calendar/types";

export function buildOrganizerInsights(input: {
  calendar: Calendar;
  calendars: Calendar[];
  cards: DiscoveryEventCard[];
  now: Date;
}): OrganizerInsights {
  const own = input.cards.filter((card) => card.event.calendarId === input.calendar.id);
  const upcoming = own.filter((card) => isDiscoverable(card, input.now));
  const trending = upcoming.filter((card) => card.trendingScore > 0).length;
  const ownTags = new Set(own.flatMap((card) => card.event.tags));
  const ownCities = new Set(own.map((card) => card.event.city).filter(Boolean));
  const tagCounts = new Map<string, number>();
  for (const card of input.cards.filter((item) => item.event.calendarId !== input.calendar.id)) {
    for (const tag of card.event.tags) {
      if (!ownTags.has(tag)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tagSuggestions = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);

  const similar = input.calendars
    .filter((calendar) => calendar.id !== input.calendar.id && calendar.visibility === "public")
    .map((calendar) => {
      const overlap = calendar.tags.filter((tag) => input.calendar.tags.includes(tag)).length;
      return { calendar, overlap };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5)
    .map(({ calendar }) => ({ id: calendar.id, slug: calendar.slug, name: calendar.name }));

  const partnerships = input.calendars
    .filter((calendar) => calendar.id !== input.calendar.id && calendar.visibility === "public")
    .flatMap((calendar) => {
      const theirEvents = input.cards.filter((card) => card.event.calendarId === calendar.id);
      const sharedTags = calendar.tags.filter((tag) => input.calendar.tags.includes(tag));
      const sharedCity = theirEvents.some((card) => card.event.city && ownCities.has(card.event.city));
      if (sharedTags.length < 1 && !sharedCity) return [];
      return [
        {
          id: calendar.id,
          slug: calendar.slug,
          name: calendar.name,
          reason: sharedCity ? "same_city" : "shared_tags",
        },
      ];
    })
    .slice(0, 5);

  const topTags = [...ownTags].slice(0, 8);
  return {
    tagSuggestions,
    similarCalendars: similar,
    discovery: {
      trendingEventCount: trending,
      upcomingEventCount: upcoming.length,
      topTags,
    },
    partnerships,
  };
}
