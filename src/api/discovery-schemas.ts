import { z } from "zod";
import { DISCOVERY_FORMATS, DISCOVERY_PRICES } from "@/domain/discovery/types";

const optionalText = z.string().max(120).optional();

export const discoverQuerySchema = z.object({
  q: optionalText,
  location: optionalText,
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  date: z.enum(["today", "this_week", "this_month", "later"]).optional(),
  dateFrom: z.string().min(1).optional(),
  dateTo: z.string().min(1).optional(),
  tag: z.string().max(40).optional(),
  category: z.string().max(40).optional(),
  format: z.enum(DISCOVERY_FORMATS).optional(),
  price: z.enum(DISCOVERY_PRICES).optional(),
  language: z.string().max(10).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  west: z.coerce.number().optional(),
  south: z.coerce.number().optional(),
  east: z.coerce.number().optional(),
  north: z.coerce.number().optional(),
  eventId: z.string().optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

export function compactSearchParams(params: URLSearchParams) {
  return Object.fromEntries([...params.entries()].filter(([, value]) => value !== ""));
}

function parseDateBound(value: string | undefined, end = false): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(end ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function datePresetWindow(preset: z.infer<typeof discoverQuerySchema>["date"], now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (preset === "today") return { dateFrom: start, dateTo: new Date(start.getTime() + DAY_MS - 1) };
  if (preset === "this_week") return { dateFrom: start, dateTo: new Date(start.getTime() + 7 * DAY_MS) };
  if (preset === "this_month") return { dateFrom: start, dateTo: new Date(start.getTime() + 30 * DAY_MS) };
  if (preset === "later") return { dateFrom: new Date(start.getTime() + 30 * DAY_MS) };
  return {};
}

export function filtersFromQuery(query: z.infer<typeof discoverQuerySchema>, now = new Date()) {
  const preset = datePresetWindow(query.date, now);
  const bbox =
    query.west != null && query.south != null && query.east != null && query.north != null
      ? { west: query.west, south: query.south, east: query.east, north: query.north }
      : undefined;
  return {
    q: query.q,
    location: query.location,
    city: query.city,
    country: query.country,
    dateFrom: parseDateBound(query.dateFrom) ?? preset.dateFrom,
    dateTo: parseDateBound(query.dateTo, true) ?? preset.dateTo,
    tag: query.tag,
    category: query.category,
    format: query.format,
    price: query.price,
    language: query.language,
    cursor: query.cursor,
    limit: query.limit,
    bbox,
  };
}
