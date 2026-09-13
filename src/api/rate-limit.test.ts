import { describe, expect, it } from "vitest";
import { RateLimitedError } from "@/domain/errors";
import { consumeRateLimit, resetRateLimits } from "@/api/rate-limit";

describe("rate limit", () => {
  it("allows traffic under the limit and blocks afterwards", () => {
    resetRateLimits();
    consumeRateLimit({ key: "auth:1", limit: 2, windowMs: 60_000, now: 1 });
    consumeRateLimit({ key: "auth:1", limit: 2, windowMs: 60_000, now: 2 });
    expect(() =>
      consumeRateLimit({ key: "auth:1", limit: 2, windowMs: 60_000, now: 3 }),
    ).toThrow(RateLimitedError);
  });

  it("resets after the window elapses", () => {
    resetRateLimits();
    consumeRateLimit({ key: "auth:2", limit: 1, windowMs: 10, now: 0 });
    expect(() =>
      consumeRateLimit({ key: "auth:2", limit: 1, windowMs: 10, now: 11 }),
    ).not.toThrow();
  });
});
