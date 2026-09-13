import { isDiscoverable, rankCards } from "@/domain/discovery/query";
import type { DiscoveryEventCard, DiscoverySections } from "@/domain/discovery/types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function buildSections(cards: DiscoveryEventCard[], now: Date): DiscoverySections {
  const upcoming = cards.filter((card) => isDiscoverable(card, now));
  return {
    trending: rankCards(upcoming).slice(0, 8),
    editorsPicks: upcoming.filter((card) => card.event.isFeatured).slice(0, 8),
    newOnPlatform: [...upcoming]
      .sort((a, b) => b.event.createdAt.getTime() - a.event.createdAt.getTime())
      .filter((card) => now.getTime() - card.event.createdAt.getTime() <= 14 * DAY_MS)
      .slice(0, 8),
    closingSoon: upcoming
      .filter((card) => {
        const delta = card.event.startsAt.getTime() - now.getTime();
        return delta >= 0 && delta <= 72 * HOUR_MS;
      })
      .sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime())
      .slice(0, 8),
  };
}
