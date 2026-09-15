import { ValidationError } from "@/domain/errors";
import { zonedInstant, zonedParts } from "@/domain/event/timezone";
import { intlLocaleFor } from "@/i18n/config";

const IANA_CACHE = new Map<string, boolean>();

export function isIanaTimeZone(timeZone: string): boolean {
  const key = timeZone.trim();
  if (!key) return false;
  const cached = IANA_CACHE.get(key);
  if (cached !== undefined) return cached;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: key }).format(new Date());
    IANA_CACHE.set(key, true);
    return true;
  } catch {
    IANA_CACHE.set(key, false);
    return false;
  }
}

export function assertIanaTimeZone(timeZone: string): string {
  const value = timeZone.trim();
  if (!isIanaTimeZone(value)) {
    throw new ValidationError(`Unknown IANA timezone '${timeZone}'`);
  }
  return value;
}

export function formatEventDateTime(
  date: Date,
  timeZone: string,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const tz = assertIanaTimeZone(timeZone);
  return new Intl.DateTimeFormat(intlLocaleFor(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
    ...options,
  }).format(date);
}

export function formatEventDate(date: Date, timeZone: string, locale: string): string {
  return formatEventDateTime(date, timeZone, locale, { dateStyle: "medium", timeStyle: undefined });
}

export function formatEventRange(start: Date, end: Date, timeZone: string, locale: string, separator = "–"): string {
  return `${formatEventDateTime(start, timeZone, locale)} ${separator} ${formatEventDateTime(end, timeZone, locale)}`;
}

export function zonedWallClock(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  return zonedInstant(parts, assertIanaTimeZone(timeZone));
}

export function partsInZone(date: Date, timeZone: string) {
  return zonedParts(date, assertIanaTimeZone(timeZone));
}
