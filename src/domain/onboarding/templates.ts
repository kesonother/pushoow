import type { CalendarWriteInput } from "@/domain/calendar/service";
import { getEventTemplate } from "@/domain/event/templates";

export const CALENDAR_TEMPLATE_IDS = ["meetup"] as const;
export type CalendarTemplateId = (typeof CALENDAR_TEMPLATE_IDS)[number];

export type CalendarTemplate = {
  id: CalendarTemplateId;
  name: string;
  description: string;
  defaults: Pick<CalendarWriteInput, "description" | "timezone" | "visibility" | "tags" | "locale">;
};

export const MEETUP_CALENDAR_TEMPLATE: CalendarTemplate = {
  id: "meetup",
  name: "Meetup",
  description: "A public community calendar for recurring meetups.",
  defaults: {
    description: "A public Meetup calendar for community gatherings, talks, and casual nights.",
    timezone: "UTC",
    visibility: "public",
    tags: ["meetup", "community"],
    locale: "en",
  },
};

export function listCalendarTemplates(): CalendarTemplate[] {
  return [MEETUP_CALENDAR_TEMPLATE];
}

export function getCalendarTemplate(id: string): CalendarTemplate | null {
  return listCalendarTemplates().find((template) => template.id === id) ?? null;
}

export function applyCalendarTemplate(
  input: CalendarWriteInput & { name: string; templateId?: string | null },
): CalendarWriteInput & { name: string } {
  const { templateId, ...rest } = input;
  const template = templateId ? getCalendarTemplate(templateId) : null;
  if (!template) {
    return rest;
  }
  return {
    ...rest,
    description: rest.description ?? template.defaults.description ?? null,
    timezone: rest.timezone ?? template.defaults.timezone,
    visibility: rest.visibility ?? template.defaults.visibility,
    tags: rest.tags ?? template.defaults.tags,
    locale: rest.locale ?? template.defaults.locale,
  };
}

export type FirstMeetupPrefill = {
  templateId: "first_meetup";
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  tags: string[];
  locationKind: "physical";
  registrationMode: "open_rsvp";
  capacity: number;
};

export function nextMeetupWindow(now = new Date()): { startsAt: Date; endsAt: Date } {
  const eventTemplate = getEventTemplate("first_meetup") ?? getEventTemplate("meetup");
  const durationMinutes = eventTemplate?.defaults.durationMinutes ?? 120;
  const startsAt = new Date(now.getTime());
  const weekday = startsAt.getUTCDay();
  const daysUntilTuesday = (2 - weekday + 7) % 7 || 7;
  startsAt.setUTCDate(startsAt.getUTCDate() + daysUntilTuesday);
  startsAt.setUTCHours(18, 30, 0, 0);
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
  };
}

export function firstMeetupPrefill(now = new Date()): FirstMeetupPrefill {
  const window = nextMeetupWindow(now);
  return {
    templateId: "first_meetup",
    title: "First Meetup",
    description: "The first gathering on this calendar — publish it, then share the public link.",
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    tags: ["meetup", "first"],
    locationKind: "physical",
    registrationMode: "open_rsvp",
    capacity: 80,
  };
}
