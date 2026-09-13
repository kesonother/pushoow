import { isDiscoverable, rankCards } from "@/domain/discovery/query";
import type { DiscoveryEventCard } from "@/domain/discovery/types";

export function contentBasedScore(seed: DiscoveryEventCard, candidate: DiscoveryEventCard): number {
  let score = 0;
  if (seed.event.category && seed.event.category === candidate.event.category) score += 4;
  if (seed.event.city && seed.event.city === candidate.event.city) score += 3;
  if (seed.format === candidate.format) score += 1;
  const overlap = seed.event.tags.filter((tag) => candidate.event.tags.includes(tag)).length;
  score += overlap * 2;
  return score;
}

export function recommendForViewer(input: {
  cards: DiscoveryEventCard[];
  now: Date;
  registeredEventIds: string[];
  coRegistrations: Map<string, string[]>;
}): DiscoveryEventCard[] {
  const upcoming = input.cards.filter((card) => isDiscoverable(card, input.now));
  const seen = new Set(input.registeredEventIds);
  const seeds = upcoming.filter((card) => seen.has(card.event.id));
  const content = new Map<string, number>();
  for (const seed of seeds) {
    for (const candidate of upcoming) {
      if (seen.has(candidate.event.id)) continue;
      content.set(
        candidate.event.id,
        (content.get(candidate.event.id) ?? 0) + contentBasedScore(seed, candidate),
      );
    }
  }
  const collaborative = new Map<string, number>();
  for (const eventId of input.registeredEventIds) {
    for (const other of input.coRegistrations.get(eventId) ?? []) {
      if (seen.has(other)) continue;
      collaborative.set(other, (collaborative.get(other) ?? 0) + 1);
    }
  }
  return upcoming
    .filter((card) => !seen.has(card.event.id))
    .map((card) => ({
      ...card,
      trendingScore:
        card.trendingScore +
        (content.get(card.event.id) ?? 0) * 2 +
        (collaborative.get(card.event.id) ?? 0) * 5,
    }))
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 8);
}

export function recommendFromEvent(
  cards: DiscoveryEventCard[],
  seedId: string,
  now: Date,
): DiscoveryEventCard[] {
  const seed = cards.find((card) => card.event.id === seedId);
  if (!seed) return rankCards(cards.filter((card) => isDiscoverable(card, now))).slice(0, 8);
  return cards
    .filter((card) => card.event.id !== seedId && isDiscoverable(card, now))
    .map((card) => ({ ...card, trendingScore: card.trendingScore + contentBasedScore(seed, card) * 3 }))
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 8);
}
