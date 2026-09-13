import type { DiscoveryEventCard, DiscoveryMap, DiscoveryPage, DiscoverySections } from "@/domain/discovery/types";

export function publicDiscoveryCard(card: DiscoveryEventCard) {
  const event = card.event;
  return {
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      status: event.status,
      visibility: event.visibility,
      isPaid: event.isPaid,
      isFeatured: event.isFeatured,
      tags: event.tags,
      city: event.city,
      country: event.country,
      category: event.category,
      language: event.language,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      coverImageUrl: event.coverImageUrl,
      capacity: event.capacity,
      locationKind: event.locationKind,
      latitude: event.latitude,
      longitude: event.longitude,
      customPinLabel: event.customPinLabel,
      virtualUrl: event.virtualUrl,
      virtualProvider: event.virtualProvider,
    },
    calendarId: card.calendarId,
    calendarName: card.calendarName,
    calendarSlug: card.calendarSlug,
    organizerName: card.organizerName,
    format: card.format,
    minPriceCents: card.minPriceCents,
    trendingScore: card.trendingScore,
  };
}

export function publicDiscoveryPage(page: DiscoveryPage) {
  return {
    items: page.items.map(publicDiscoveryCard),
    nextCursor: page.nextCursor,
    facets: page.facets,
  };
}

export function publicDiscoverySections(sections: DiscoverySections) {
  return {
    trending: sections.trending.map(publicDiscoveryCard),
    editorsPicks: sections.editorsPicks.map(publicDiscoveryCard),
    newOnPlatform: sections.newOnPlatform.map(publicDiscoveryCard),
    closingSoon: sections.closingSoon.map(publicDiscoveryCard),
  };
}

export function publicDiscoveryMap(map: DiscoveryMap) {
  return {
    clusters: map.clusters,
    events: map.events.map(publicDiscoveryCard),
    unlocated: map.unlocated.map(publicDiscoveryCard),
  };
}
