import { describe, expect, it } from "vitest";
import { ValidationError } from "@/domain/errors";
import {
  assertCalendarSlug,
  containsBlockedSlur,
  type BrandCheckAdapter,
} from "@/domain/calendar/slug-policy";

describe("calendar slug policy", () => {
  it("rejects reserved slugs", async () => {
    await expect(assertCalendarSlug("admin")).rejects.toBeInstanceOf(ValidationError);
    await expect(assertCalendarSlug("login")).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects slurs", async () => {
    expect(containsBlockedSlur("not-a-slur")).toBe(false);
    await expect(assertCalendarSlug("some-nigger-word")).rejects.toBeInstanceOf(ValidationError);
  });

  it("normalizes and accepts a valid slug", async () => {
    await expect(assertCalendarSlug("Tech Meetup")).resolves.toBe("tech-meetup");
  });

  it("asks a configured brand checker", async () => {
    const brand: BrandCheckAdapter = {
      isConfigured: () => true,
      assertAvailable: async () => {
        throw new ValidationError("This slug conflicts with a known brand");
      },
    };
    await expect(assertCalendarSlug("nike", brand)).rejects.toBeInstanceOf(ValidationError);
  });

  it("skips brand checks when no service is configured", async () => {
    await expect(assertCalendarSlug("nike")).resolves.toBe("nike");
  });
});
