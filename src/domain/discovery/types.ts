import type { Event, LocationKind } from "@/domain/event/types";

export const DISCOVERY_FORMATS = ["online", "in-person", "hybrid"] as const;
export type DiscoveryFormat = (typeof DISCOVERY_FORMATS)[number];

export const DISCOVERY_PRICES = ["free", "under_25", "under_100", "paid"] as const;
export type DiscoveryPrice = (typeof DISCOVERY_PRICES)[number];

export const FEATURED_MIN_EVENTS = 10;
export const FEATURED_MIN_FOLLOWERS = 100;
export const FEATURED_MIN_ATTENDANCE = 0.7;

export type DiscoveryFilters = {
  q?: string;
  location?: string;
  city?: string;
  country?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tag?: string;
  category?: string;
  format?: DiscoveryFormat;
  price?: DiscoveryPrice;
  language?: string;
  cursor?: string;
  limit?: number;
  bbox?: { west: number; south: number; east: number; north: number };
};

export type DiscoveryEventCard = {
  event: Event;
  calendarId: string;
  calendarName: string;
  calendarSlug: string;
  organizerName: string;
  format: DiscoveryFormat;
  minPriceCents: number;
  trendingScore: number;
};

export type DiscoveryFacet = { value: string; count: number };

export type DiscoveryFacets = {
  city: DiscoveryFacet[];
  date: DiscoveryFacet[];
  format: DiscoveryFacet[];
  tag: DiscoveryFacet[];
  price: DiscoveryFacet[];
  language: DiscoveryFacet[];
  capacity: DiscoveryFacet[];
};

export type DiscoveryPage = {
  items: DiscoveryEventCard[];
  nextCursor: string | null;
  facets: DiscoveryFacets;
};

export type MapCluster = {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  eventIds: string[];
};

export type DiscoveryMap = {
  clusters: MapCluster[];
  events: DiscoveryEventCard[];
  unlocated: DiscoveryEventCard[];
};

export type DiscoverySections = {
  trending: DiscoveryEventCard[];
  editorsPicks: DiscoveryEventCard[];
  newOnPlatform: DiscoveryEventCard[];
  closingSoon: DiscoveryEventCard[];
};

export type FeaturedCalendarCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  publishedEventCount: number;
  followerCount: number;
  averageAttendance: number | null;
  buyable: false;
};

export type OrganizerInsights = {
  tagSuggestions: string[];
  similarCalendars: Array<{ id: string; slug: string; name: string }>;
  discovery: {
    trendingEventCount: number;
    upcomingEventCount: number;
    topTags: string[];
  };
  partnerships: Array<{ id: string; slug: string; name: string; reason: string }>;
};

export function formatFromLocation(kind: LocationKind): DiscoveryFormat {
  if (kind === "virtual") return "online";
  if (kind === "hybrid") return "hybrid";
  return "in-person";
}

export function priceBand(minPriceCents: number): DiscoveryPrice {
  if (minPriceCents <= 0) return "free";
  if (minPriceCents <= 2500) return "under_25";
  if (minPriceCents <= 10_000) return "under_100";
  return "paid";
}

export function capacityBand(capacity: number | null): string {
  if (capacity == null) return "unlimited";
  if (capacity <= 20) return "small";
  if (capacity <= 100) return "medium";
  return "large";
}
