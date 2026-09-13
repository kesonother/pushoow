import { isDiscoverable, matchesFilters, matchesSearch } from "@/domain/discovery/query";
import type { DiscoveryEventCard, DiscoveryFilters, DiscoveryMap, MapCluster } from "@/domain/discovery/types";

export function clusterEvents(cards: DiscoveryEventCard[], cell = 0.08): MapCluster[] {
  const groups = new Map<string, DiscoveryEventCard[]>();
  for (const card of cards) {
    const lat = card.event.latitude;
    const lng = card.event.longitude;
    if (lat == null || lng == null) continue;
    const key = `${Math.round(lat / cell) * cell}:${Math.round(lng / cell) * cell}`;
    const list = groups.get(key) ?? [];
    list.push(card);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([id, items]) => {
    const latitude = items.reduce((sum, item) => sum + (item.event.latitude ?? 0), 0) / items.length;
    const longitude = items.reduce((sum, item) => sum + (item.event.longitude ?? 0), 0) / items.length;
    return {
      id,
      latitude,
      longitude,
      count: items.length,
      eventIds: items.map((item) => item.event.id),
    };
  });
}

export function buildMap(cards: DiscoveryEventCard[], filters: DiscoveryFilters, now: Date): DiscoveryMap {
  const visible = cards
    .filter((card) => isDiscoverable(card, now))
    .filter((card) => matchesSearch(card, filters.q))
    .filter((card) => matchesFilters(card, { ...filters, bbox: undefined }));
  const located = visible.filter((card) => card.event.latitude != null && card.event.longitude != null);
  const inView = filters.bbox
    ? located.filter((card) => matchesFilters(card, { bbox: filters.bbox }))
    : located;
  const span = filters.bbox
    ? Math.max(filters.bbox.east - filters.bbox.west, filters.bbox.north - filters.bbox.south)
    : 2;
  const cell = span > 20 ? 1 : span > 5 ? 0.25 : 0.08;
  return {
    clusters: clusterEvents(inView, cell),
    events: inView.slice(0, filters.limit ?? 40),
    unlocated: visible.filter((card) => card.event.latitude == null || card.event.longitude == null),
  };
}
