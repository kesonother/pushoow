import { DISCOVERY_FORMATS, DISCOVERY_PRICES, type DiscoveryFilters, type DiscoveryFormat, type DiscoveryPrice } from "@/domain/discovery/types";
import { tokenize } from "@/domain/discovery/query";
import type { InterpretedSearch } from "@/domain/ai/types";
import { AI_DISCLOSURE, SUGGESTION_CERTAINTY } from "@/domain/ai/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const STOPWORDS = new Set([
  "find",
  "me",
  "a",
  "an",
  "the",
  "in",
  "at",
  "on",
  "for",
  "with",
  "next",
  "this",
  "week",
  "weekend",
  "today",
  "tomorrow",
  "please",
  "looking",
  "show",
  "events",
  "event",
  "something",
  "low",
  "key",
  "chill",
  "quiet",
]);

const CITY_ALIASES: Record<string, string> = {
  nyc: "New York",
  ny: "New York",
  "new york": "New York",
  "new york city": "New York",
  sf: "San Francisco",
  "san francisco": "San Francisco",
  la: "Los Angeles",
  "los angeles": "Los Angeles",
  paris: "Paris",
  london: "London",
  berlin: "Berlin",
};

const FORMAT_HINTS: Array<{ keys: string[]; format: DiscoveryFormat }> = [
  { keys: ["online", "virtual", "zoom", "webinar"], format: "online" },
  { keys: ["hybrid"], format: "hybrid" },
  { keys: ["dinner", "meetup", "irl", "inperson", "in-person", "offline"], format: "in-person" },
];

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nextWeekRange(now: Date): { dateFrom: Date; dateTo: Date } {
  const start = startOfUtcDay(now);
  const day = start.getUTCDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
  const dateFrom = new Date(start.getTime() + daysUntilNextMonday * DAY_MS);
  const dateTo = new Date(dateFrom.getTime() + 7 * DAY_MS - 1);
  return { dateFrom, dateTo };
}

function thisWeekRange(now: Date): { dateFrom: Date; dateTo: Date } {
  const start = startOfUtcDay(now);
  return { dateFrom: start, dateTo: new Date(start.getTime() + 7 * DAY_MS - 1) };
}

function detectCity(normalized: string): string | undefined {
  const ordered = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of ordered) {
    const pattern = new RegExp(`(?:^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i");
    if (pattern.test(normalized)) return CITY_ALIASES[alias];
  }
  return undefined;
}

function detectFormat(normalized: string): DiscoveryFormat | undefined {
  for (const hint of FORMAT_HINTS) {
    if (hint.keys.some((key) => normalized.includes(key))) return hint.format;
  }
  return undefined;
}

function detectPrice(normalized: string): DiscoveryPrice | undefined {
  if (/\bfree\b/.test(normalized) || /\bno cost\b/.test(normalized)) return "free";
  return undefined;
}

function detectTagAndQuery(normalized: string, consumed: Set<string>): { tag?: string; q?: string } {
  const tokens = tokenize(normalized).filter((token) => !STOPWORDS.has(token) && !consumed.has(token));
  const tag = tokens.find((token) => token === "ai" || token === "ml") ?? tokens.find((token) => token.length >= 3);
  const rest = tokens.filter((token) => token !== tag);
  return {
    tag,
    q: rest.length > 0 ? rest.join(" ") : undefined,
  };
}

export function interpretSearchIntent(query: string, now: Date, providerId = "heuristic"): InterpretedSearch {
  const normalized = query.toLowerCase().replace(/low[\s-]?key/g, "low-key");
  const notes: string[] = [];
  const consumed = new Set<string>(["nyc", "ny", "sf", "la"]);

  const city = detectCity(normalized);
  const format = detectFormat(normalized);
  const price = detectPrice(normalized);
  if (normalized.includes("low-key")) notes.push("low-key");

  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (/\bnext week\b/.test(normalized)) {
    const window = nextWeekRange(now);
    dateFrom = window.dateFrom;
    dateTo = window.dateTo;
    notes.push("next_week");
  } else if (/\bthis week\b/.test(normalized)) {
    const window = thisWeekRange(now);
    dateFrom = window.dateFrom;
    dateTo = window.dateTo;
    notes.push("this_week");
  } else if (/\btoday\b/.test(normalized)) {
    const start = startOfUtcDay(now);
    dateFrom = start;
    dateTo = new Date(start.getTime() + DAY_MS - 1);
  }

  const { tag, q } = detectTagAndQuery(normalized, consumed);
  const filters: DiscoveryFilters = {};
  if (q) filters.q = q;
  if (city) filters.city = city;
  if (tag) filters.tag = tag;
  if (format) filters.format = format;
  if (price) filters.price = price;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  return {
    query,
    filters,
    notes,
    aiGenerated: true,
    disclosure: AI_DISCLOSURE,
    certainty: SUGGESTION_CERTAINTY,
    providerId,
  };
}

export function filtersFromModelJson(value: unknown, now: Date): DiscoveryFilters | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const filters: DiscoveryFilters = {};
  if (typeof raw.q === "string" && raw.q.trim()) filters.q = raw.q.trim().slice(0, 120);
  if (typeof raw.city === "string" && raw.city.trim()) filters.city = raw.city.trim().slice(0, 80);
  if (typeof raw.country === "string" && raw.country.trim()) filters.country = raw.country.trim().slice(0, 80);
  if (typeof raw.location === "string" && raw.location.trim()) filters.location = raw.location.trim().slice(0, 120);
  if (typeof raw.tag === "string" && raw.tag.trim()) filters.tag = raw.tag.trim().toLowerCase().slice(0, 40);
  if (typeof raw.format === "string" && (DISCOVERY_FORMATS as readonly string[]).includes(raw.format)) {
    filters.format = raw.format as DiscoveryFormat;
  }
  if (typeof raw.price === "string" && (DISCOVERY_PRICES as readonly string[]).includes(raw.price)) {
    filters.price = raw.price as DiscoveryPrice;
  }
  if (typeof raw.dateFrom === "string") {
    const parsed = new Date(raw.dateFrom);
    if (!Number.isNaN(parsed.getTime())) filters.dateFrom = parsed;
  }
  if (typeof raw.dateTo === "string") {
    const parsed = new Date(raw.dateTo);
    if (!Number.isNaN(parsed.getTime())) filters.dateTo = parsed;
  }
  if (!filters.dateFrom && !filters.dateTo && raw.nextWeek === true) {
    const window = nextWeekRange(now);
    filters.dateFrom = window.dateFrom;
    filters.dateTo = window.dateTo;
  }
  return filters;
}
