import { describe, expect, it } from "vitest";
import { buildHomeFeed, dummyCommunities, dummyEvents, padItems } from "@/domain/home/feed";

describe("home feed", () => {
  it("pads short lists with fallback items without duplicating ids", () => {
    const fallback = dummyEvents("fr").slice(0, 6);
    const live = [{ ...fallback[0]!, id: "live-1", title: "Live meetup" }];
    const padded = padItems(live, fallback, 6);
    expect(padded).toHaveLength(6);
    expect(padded[0]?.id).toBe("live-1");
    expect(new Set(padded.map((item) => item.id)).size).toBe(6);
  });

  it("builds a complete landing feed from empty discovery data", () => {
    const feed = buildHomeFeed({
      locale: "fr",
      defaultCity: "Paris",
      popular: [],
      upcoming: [],
      communities: [],
    });
    expect(feed.city).toBe("Paris");
    expect(feed.popular).toHaveLength(6);
    expect(feed.upcoming).toHaveLength(4);
    expect(feed.communities).toHaveLength(6);
    expect(dummyCommunities()).toHaveLength(6);
  });
});
