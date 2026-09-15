import type { CalendarRepository } from "@/domain/calendar/types";
import type { EventRepository } from "@/domain/event/types";
import { isIndexableCalendar, isIndexableEvent } from "./indexability";
import { buildSitemap } from "./sitemap";
import { robotsDocument } from "./robots";

export function createSeoService(deps: { events: EventRepository; calendars: CalendarRepository }) {
  async function indexableEventSlugs() {
    const [events, calendars] = await Promise.all([deps.events.listPublic(), deps.calendars.listPublic()]);
    const calendarById = new Map(calendars.map((item) => [item.id, item]));
    return events
      .filter((event) => isIndexableEvent(event, calendarById.get(event.calendarId) ?? null))
      .map((event) => event.slug);
  }

  async function indexableCalendarSlugs() {
    const calendars = await deps.calendars.listPublic();
    return calendars.filter(isIndexableCalendar).map((calendar) => calendar.slug);
  }

  return {
    indexableEventSlugs,
    indexableCalendarSlugs,
    sitemap: () => buildSitemap(deps),
    robots: robotsDocument,
  };
}
