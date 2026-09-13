import { describe, expect, it } from "vitest";
import { ValidationError } from "@/domain/errors";
import { normalizeSlug, slugFromName } from "@/lib/slug";

describe("slug", () => {
  it("normalizes human names into stable slugs", () => {
    expect(slugFromName("Paris AI Meetup")).toBe("paris-ai-meetup");
    expect(normalizeSlug("  Hello__World!! ")).toBe("hello-world");
  });

  it("rejects empty or invalid results", () => {
    expect(() => normalizeSlug("***")).toThrow(ValidationError);
  });
});
