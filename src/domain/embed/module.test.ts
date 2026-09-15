import { afterEach, describe, expect, it } from "vitest";
import { resetMetrics } from "@/observability/metrics";
import { createMemoryEmbedImpressions } from "./memory";
import { createEmbedService } from "./service";

afterEach(() => {
  resetMetrics();
});

describe("embed impressions", () => {
  it("does not track unless the host opts in", async () => {
    const embeds = createEmbedService({ impressions: createMemoryEmbedImpressions() });
    const skipped = await embeds.recordImpression({ kind: "calendar", resourceId: "cal_1", track: false });
    expect(skipped.recorded).toBe(false);
    const counted = await embeds.recordImpression({ kind: "rsvp", resourceId: "evt_1", track: true });
    expect(counted).toMatchObject({ recorded: true, views: 1 });
  });
});
