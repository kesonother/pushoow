import type { EmbedImpression, EmbedImpressionRepository, EmbedKind } from "./types";

export function createMemoryEmbedImpressions(): EmbedImpressionRepository {
  const items = new Map<string, EmbedImpression>();
  return {
    async increment(input) {
      const key = `${input.kind}:${input.resourceId}:${input.day}`;
      const current = items.get(key);
      const next = current
        ? { ...current, views: current.views + 1 }
        : { id: input.id, kind: input.kind, resourceId: input.resourceId, day: input.day, views: 1 };
      items.set(key, next);
      return next;
    },
    async listByResource(kind: EmbedKind, resourceId: string) {
      return [...items.values()].filter((item) => item.kind === kind && item.resourceId === resourceId);
    },
  };
}
