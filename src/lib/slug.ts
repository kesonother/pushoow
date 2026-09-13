import { ValidationError } from "@/domain/errors";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new ValidationError("A valid slug is required", { slug: value });
  }

  return slug;
}

export function slugFromName(name: string): string {
  return normalizeSlug(name);
}
