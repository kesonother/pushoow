import { ValidationError } from "@/domain/errors";

export function normalizeHexColor(
  value: string | null | undefined,
  field = "color",
): string | null {
  if (value == null || value.trim() === "") return null;
  const color = value.trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
    throw new ValidationError(`${field} must be a hex color like #112233`);
  }
  return color.toLowerCase();
}
