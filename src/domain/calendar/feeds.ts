import { ForbiddenError, NotFoundError } from "@/domain/errors";
import type { Calendar, CalendarRepository } from "@/domain/calendar/types";
import { isListedEventStatus, type Event, type EventRepository } from "@/domain/event/types";

export type FeedKind = "ics" | "rss" | "atom";

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return chunks.join("\r\n");
}

function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function eventsForFeed(events: Event[]): Event[] {
  return events
    .filter((event) => !event.deletedAt)
    .filter((event) => isListedEventStatus(event.status) || event.status === "cancelled")
    .filter((event) => event.visibility !== "private")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function renderIcs(calendar: Calendar, events: Event[], origin: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pushoow//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(calendar.name)}`,
    `X-WR-TIMEZONE:${icsText(calendar.timezone)}`,
    "X-WR-CALDESC:One-way subscription feed. This is not a bidirectional Google/Apple Calendar sync.",
  ];

  for (const event of eventsForFeed(events)) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@pushoow`);
    lines.push(`DTSTAMP:${icsDate(event.updatedAt)}`);
    lines.push(`DTSTART:${icsDate(event.startsAt)}`);
    lines.push(`DTEND:${icsDate(event.endsAt)}`);
    lines.push(`SUMMARY:${icsText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${icsText(event.description)}`);
    if (event.venueAddress) lines.push(`LOCATION:${icsText(event.venueAddress)}`);
    lines.push(`URL:${origin}/c/${calendar.slug}`);
    lines.push(`LAST-MODIFIED:${icsDate(event.updatedAt)}`);
    lines.push(`STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`);
    lines.push(`SEQUENCE:${Math.max(0, Math.floor(event.updatedAt.getTime() / 1000) % 1_000_000)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderRss(calendar: Calendar, events: Event[], origin: string): string {
  const items = eventsForFeed(events)
    .map((event) => {
      return [
        "<item>",
        `<title>${xmlEscape(event.title)}</title>`,
        `<link>${origin}/c/${calendar.slug}</link>`,
        `<guid isPermaLink="false">${event.id}</guid>`,
        `<pubDate>${event.startsAt.toUTCString()}</pubDate>`,
        `<lastBuildDate>${event.updatedAt.toUTCString()}</lastBuildDate>`,
        event.description ? `<description>${xmlEscape(event.description)}</description>` : "",
        "</item>",
      ]
        .filter(Boolean)
        .join("");
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xmlEscape(calendar.name)}</title><link>${origin}/c/${calendar.slug}</link><description>${xmlEscape(calendar.description ?? calendar.name)}</description>${items}</channel></rss>`;
}

export function renderAtom(calendar: Calendar, events: Event[], origin: string): string {
  const entries = eventsForFeed(events)
    .map((event) => {
      return `<entry><id>urn:pushoow:event:${event.id}</id><title>${xmlEscape(event.title)}</title><updated>${event.updatedAt.toISOString()}</updated><link href="${origin}/c/${calendar.slug}"/><summary>${xmlEscape(event.description ?? event.title)}</summary></entry>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${xmlEscape(calendar.name)}</title><id>urn:pushoow:calendar:${calendar.id}</id><updated>${calendar.updatedAt.toISOString()}</updated><link href="${origin}/c/${calendar.slug}"/><subtitle>One-way subscription feed. This is not a bidirectional calendar sync.</subtitle>${entries}</feed>`;
}

export function createCalendarFeedService(deps: {
  calendars: CalendarRepository;
  events: EventRepository;
}) {
  async function load(slug: string, token?: string | null) {
    const calendar = await deps.calendars.findBySlug(slug);
    if (!calendar || calendar.deletedAt) {
      throw new NotFoundError("Calendar", slug);
    }
    if (calendar.visibility === "private" && token !== calendar.feedToken) {
      throw new ForbiddenError("A feed token is required for this calendar");
    }
    const events = await deps.events.listByCalendar(calendar.id);
    return { calendar, events };
  }

  async function render(slug: string, kind: FeedKind, origin: string, token?: string | null) {
    const { calendar, events } = await load(slug, token);
    if (kind === "ics") return { body: renderIcs(calendar, events, origin), contentType: "text/calendar; charset=utf-8" };
    if (kind === "rss") return { body: renderRss(calendar, events, origin), contentType: "application/rss+xml; charset=utf-8" };
    return { body: renderAtom(calendar, events, origin), contentType: "application/atom+xml; charset=utf-8" };
  }

  return { load, render };
}
