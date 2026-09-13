import { ValidationError } from "@/domain/errors";
import { normalizeSlug } from "@/lib/slug";

export const RESERVED_CALENDAR_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "c",
  "calendar",
  "calendars",
  "dashboard",
  "discover",
  "e",
  "event",
  "events",
  "feed",
  "health",
  "help",
  "invitations",
  "join",
  "login",
  "me",
  "new",
  "organizations",
  "privacy",
  "profile",
  "register",
  "rss",
  "settings",
  "static",
  "support",
  "verify-email",
]);

const SLUR_FRAGMENTS = [
  "nigger",
  "nigga",
  "faggot",
  "kike",
  "spic",
  "retard",
  "tranny",
];

export type BrandCheckAdapter = {
  isConfigured: () => boolean;
  assertAvailable: (slug: string) => Promise<void>;
};

export const noopBrandChecker: BrandCheckAdapter = {
  isConfigured: () => false,
  async assertAvailable() {
    // No trademark service is configured; do not invent a brand verdict.
  },
};

export function containsBlockedSlur(slug: string): boolean {
  const compact = slug.replace(/-/g, "");
  return SLUR_FRAGMENTS.some((fragment) => compact.includes(fragment));
}

export async function assertCalendarSlug(
  raw: string,
  brand: BrandCheckAdapter = noopBrandChecker,
): Promise<string> {
  const slug = normalizeSlug(raw);
  if (slug.length < 2) {
    throw new ValidationError("Slug is too short");
  }
  if (RESERVED_CALENDAR_SLUGS.has(slug)) {
    throw new ValidationError("This slug is reserved", { slug });
  }
  if (containsBlockedSlur(slug)) {
    throw new ValidationError("This slug is not allowed", { slug });
  }
  if (brand.isConfigured()) {
    await brand.assertAvailable(slug);
  }
  return slug;
}

export const MAX_SLUG_CHANGES_PER_YEAR = 2;
