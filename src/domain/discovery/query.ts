import { isListedEventStatus } from "@/domain/event/types";
import {
  capacityBand,
  formatFromLocation,
  priceBand,
  type DiscoveryEventCard,
  type DiscoveryFacets,
  type DiscoveryFilters,
  type DiscoveryFormat,
  type DiscoveryPage,
  type DiscoveryPrice,
} from "@/domain/discovery/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isDiscoverable(card: DiscoveryEventCard, now: Date): boolean {
  const event = card.event;
  if (event.deletedAt || event.visibility !== "public") return false;
  if (event.status === "cancelled" || event.status === "draft") return false;
  if (!isListedEventStatus(event.status) && event.status !== "ended") return false;
  return event.endsAt >= now;
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

export function matchesSearch(card: DiscoveryEventCard, query?: string): boolean {
  if (!query?.trim()) return true;
  const tokens = tokenize(query);
  if (tokens.length === 0) return true;
  const haystack = [
    card.event.title,
    card.event.description,
    card.event.tags.join(" "),
    card.event.city,
    card.event.country,
    card.event.venueName,
    card.event.venueAddress,
    card.organizerName,
    card.calendarName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export function matchesFilters(card: DiscoveryEventCard, filters: DiscoveryFilters): boolean {
  const event = card.event;
  if (filters.city && event.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
  if (filters.country && event.country?.toLowerCase() !== filters.country.toLowerCase()) return false;
  if (filters.category && event.category?.toLowerCase() !== filters.category.toLowerCase()) return false;
  if (filters.language && event.language?.toLowerCase() !== filters.language.toLowerCase()) return false;
  if (filters.tag && !event.tags.includes(filters.tag.toLowerCase())) return false;
  if (filters.format && card.format !== filters.format) return false;
  if (filters.price && !matchesPrice(card.minPriceCents, filters.price)) return false;
  if (filters.dateFrom && event.startsAt < filters.dateFrom) return false;
  if (filters.dateTo && event.startsAt > filters.dateTo) return false;
  if (filters.location) {
    const location = [event.venueName, event.venueAddress, event.city, event.country]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!location.includes(filters.location.toLowerCase())) return false;
  }
  if (filters.bbox && event.latitude != null && event.longitude != null) {
    const { west, south, east, north } = filters.bbox;
    if (event.longitude < west || event.longitude > east || event.latitude < south || event.latitude > north) {
      return false;
    }
  }
  return true;
}

function matchesPrice(minPriceCents: number, price: DiscoveryPrice): boolean {
  if (price === "free") return minPriceCents <= 0;
  if (price === "under_25") return minPriceCents > 0 && minPriceCents <= 2500;
  if (price === "under_100") return minPriceCents > 0 && minPriceCents <= 10_000;
  return minPriceCents > 0;
}

function increment(map: Map<string, number>, key: string | null | undefined) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function top(map: Map<string, number>, limit = 12) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

export function buildFacets(cards: DiscoveryEventCard[], now: Date): DiscoveryFacets {
  const city = new Map<string, number>();
  const date = new Map<string, number>();
  const format = new Map<string, number>();
  const tag = new Map<string, number>();
  const price = new Map<string, number>();
  const language = new Map<string, number>();
  const capacity = new Map<string, number>();
  for (const card of cards) {
    increment(city, card.event.city?.toLowerCase());
    increment(language, card.event.language?.toLowerCase());
    increment(format, card.format);
    increment(price, priceBand(card.minPriceCents));
    increment(capacity, capacityBand(card.event.capacity));
    for (const item of card.event.tags) increment(tag, item);
    const days = Math.floor((card.event.startsAt.getTime() - now.getTime()) / DAY_MS);
    if (days <= 0) increment(date, "today");
    else if (days <= 7) increment(date, "this_week");
    else if (days <= 30) increment(date, "this_month");
    else increment(date, "later");
  }
  return {
    city: top(city),
    date: top(date),
    format: top(format),
    tag: top(tag),
    price: top(price),
    language: top(language),
    capacity: top(capacity),
  };
}

export function paginateCards(cards: DiscoveryEventCard[], cursor?: string, limit = 20): DiscoveryPage["items"] {
  const start = cursor ? cards.findIndex((item) => item.event.id === cursor) + 1 : 0;
  const safe = start < 0 ? 0 : start;
  return cards.slice(safe, safe + limit);
}

export function rankCards(cards: DiscoveryEventCard[]): DiscoveryEventCard[] {
  return [...cards].sort((a, b) => {
    if (b.trendingScore !== a.trendingScore) return b.trendingScore - a.trendingScore;
    return a.event.startsAt.getTime() - b.event.startsAt.getTime();
  });
}

export function searchAndFilter(
  cards: DiscoveryEventCard[],
  filters: DiscoveryFilters,
  now: Date,
): DiscoveryPage {
  const discoverable = cards.filter((card) => isDiscoverable(card, now));
  const searched = discoverable.filter((card) => matchesSearch(card, filters.q));
  const facets = buildFacets(searched, now);
  const filtered = searched.filter((card) => matchesFilters(card, filters));
  const ranked = rankCards(filtered);
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
  const items = paginateCards(ranked, filters.cursor, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: last && items.length === limit ? last.event.id : null,
    facets,
  };
}

export function formatLabel(format: DiscoveryFormat): DiscoveryFormat {
  return format;
}

export { formatFromLocation };
