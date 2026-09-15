import type { MetadataRoute } from "next";
import type { Calendar } from "@/domain/calendar/types";
import type { Event } from "@/domain/event/types";
import { absoluteUrl, publicOrigin } from "@/lib/public-url";
import { isIndexableCalendar, isIndexableEvent } from "./indexability";

export const STATIC_SITEMAP_PATHS = ["/", "/discover", "/calendars", "/press", "/docs/api", "/status", "/register"] as const;

export type SitemapDeps = {
  events: { listPublic: (excludeId?: string) => Promise<Event[]> };
  calendars: { listPublic: (excludeId?: string) => Promise<Calendar[]> };
  origin?: string;
};

export function staticSitemapEntries(origin = publicOrigin()): MetadataRoute.Sitemap {
  return STATIC_SITEMAP_PATHS.map((path) => ({
    url: absoluteUrl(path, origin),
    changeFrequency: path === "/" ? "weekly" : "daily",
    priority: path === "/" ? 1 : path === "/discover" ? 0.9 : 0.7,
  }));
}

export async function buildSitemap(deps: SitemapDeps): Promise<MetadataRoute.Sitemap> {
  const origin = deps.origin ?? publicOrigin();
  const [events, calendars] = await Promise.all([deps.events.listPublic(), deps.calendars.listPublic()]);
  const calendarById = new Map(calendars.map((item) => [item.id, item]));
  const eventEntries: MetadataRoute.Sitemap = events
    .filter((event) => isIndexableEvent(event, calendarById.get(event.calendarId) ?? null))
    .slice(0, 8_000)
    .map((event) => ({
      url: absoluteUrl(`/e/${event.slug}`, origin),
      lastModified: event.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
      images: event.coverImageUrl ? [event.coverImageUrl] : undefined,
    }));
  const calendarEntries: MetadataRoute.Sitemap = calendars
    .filter(isIndexableCalendar)
    .slice(0, 2_000)
    .map((calendar) => ({
      url: absoluteUrl(`/c/${calendar.slug}`, origin),
      lastModified: calendar.updatedAt,
      changeFrequency: "daily",
      priority: 0.75,
      images: calendar.logoUrl ? [calendar.logoUrl] : undefined,
    }));
  return [...staticSitemapEntries(origin), ...calendarEntries, ...eventEntries];
}
