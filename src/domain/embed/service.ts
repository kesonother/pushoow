import { increment } from "@/observability/metrics";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { EMBED_KINDS, type EmbedImpressionRepository, type EmbedKind } from "./types";

export function isEmbedKind(value: string): value is EmbedKind {
  return (EMBED_KINDS as readonly string[]).includes(value);
}

export function createEmbedService(deps: {
  impressions: EmbedImpressionRepository;
  clock?: Clock;
  ids?: IdGenerator;
}) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  return {
    async recordImpression(input: { kind: EmbedKind; resourceId: string; track: boolean }) {
      if (!input.track) return { recorded: false as const, reason: "opt_in_required" as const };
      const resourceId = input.resourceId.trim();
      if (!resourceId) return { recorded: false as const, reason: "invalid" as const };
      const day = clock.now().toISOString().slice(0, 10);
      const row = await deps.impressions.increment({
        kind: input.kind,
        resourceId,
        day,
        id: ids.id(),
      });
      increment("embed.impressions", { kind: input.kind });
      return { recorded: true as const, views: row.views, day: row.day };
    },
  };
}
