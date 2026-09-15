import { NotFoundError } from "@/domain/errors";
import { canViewPrivateCalendar, toPublicCalendar } from "@/domain/calendar/access";
import type { CalendarFollowerRepository } from "@/domain/calendar/follow-types";
import type {
  CalendarMember,
  CalendarMemberRepository,
  CalendarMembershipTier,
  CalendarMembershipTierRepository,
} from "@/domain/calendar/membership-types";
import type { Calendar, CalendarRepository } from "@/domain/calendar/types";
import { isListedEventStatus, type Event, type EventRepository } from "@/domain/event/types";
import type { MembershipRepository } from "@/domain/organization/types";
import { intlLocaleFor } from "@/i18n/config";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";

export type MonthGroup = {
  key: string;
  label: string;
  events: Event[];
};

export type CalendarPublicView =
  | {
      access: "full";
      calendar: ReturnType<typeof toPublicCalendar>;
      eventsByMonth: MonthGroup[];
      featured: Event[];
      tags: string[];
      followerCount: number;
      following: boolean;
      followPreferences: { email: boolean; push: boolean; sms: boolean } | null;
      similar: ReturnType<typeof toPublicCalendar>[];
      map: {
        postalAddress: string | null;
        latitude: number | null;
        longitude: number | null;
        openStreetMapUrl: string | null;
      };
    }
  | {
      access: "join";
      calendar: ReturnType<typeof toPublicCalendar>;
      tiers: CalendarMembershipTier[];
      membership: CalendarMember | null;
      followerCount: number;
    };

export type PublicCalendarServiceDeps = {
  calendars: CalendarRepository;
  events: EventRepository;
  followers: CalendarFollowerRepository;
  tiers: CalendarMembershipTierRepository;
  calendarMembers: CalendarMemberRepository;
  orgMembers: MembershipRepository;
  clock?: Clock;
};

function visibleEvents(events: Event[], memberView: boolean, now: Date): Event[] {
  return events
    .filter((event) => !event.deletedAt)
    .filter((event) => isListedEventStatus(event.status) || event.status === "cancelled")
    .filter((event) => event.endsAt >= now)
    .filter((event) => memberView || event.visibility !== "private")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function groupEventsByMonth(events: Event[], locale: string, timeZone: string): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  const formatter = new Intl.DateTimeFormat(intlLocaleFor(locale), {
    month: "long",
    year: "numeric",
    timeZone,
  });

  for (const event of events) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone,
    }).formatToParts(event.startsAt);
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "01";
    const key = `${year}-${month}`;
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(key, { key, label: formatter.format(event.startsAt), events: [event] });
    }
  }

  return [...groups.values()];
}

function similarCalendars(calendar: Calendar, candidates: Calendar[]): Calendar[] {
  const tags = new Set(calendar.tags);
  return candidates
    .filter((item) => item.id !== calendar.id && !item.deletedAt && item.visibility === "public")
    .map((item) => ({
      item,
      score: item.tags.filter((tag) => tags.has(tag)).length + (item.timezone === calendar.timezone ? 0.25 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.item);
}

function mapFor(calendar: Calendar, events: Event[]) {
  const venue = events.find((event) => event.venueAddress)?.venueAddress ?? null;
  const postalAddress = calendar.postalAddress ?? venue;
  const hasCoords =
    calendar.latitude != null &&
    calendar.longitude != null &&
    Number.isFinite(calendar.latitude) &&
    Number.isFinite(calendar.longitude);
  const query = hasCoords
    ? `${calendar.latitude}/${calendar.longitude}`
    : postalAddress
      ? encodeURIComponent(postalAddress)
      : null;
  return {
    postalAddress,
    latitude: hasCoords ? calendar.latitude : null,
    longitude: hasCoords ? calendar.longitude : null,
    openStreetMapUrl: query
      ? hasCoords
        ? `https://www.openstreetmap.org/#map=14/${query}`
        : `https://www.openstreetmap.org/search?query=${query}`
      : null,
  };
}

export function createPublicCalendarService(deps: PublicCalendarServiceDeps) {
  const clock = deps.clock ?? systemClock;

  async function getView(slug: string, userId?: string): Promise<CalendarPublicView> {
    const calendar = await deps.calendars.findBySlug(slug);
    if (!calendar || calendar.deletedAt) {
      throw new NotFoundError("Calendar", slug);
    }

    const followerCount = await deps.followers.countByCalendar(calendar.id);
    const follower = userId
      ? await deps.followers.findByUserAndCalendar(userId, calendar.id)
      : null;
    const following = Boolean(follower);

    if (calendar.visibility === "private") {
      const allowed = await canViewPrivateCalendar(
        { orgMembers: deps.orgMembers, calendarMembers: deps.calendarMembers },
        userId,
        calendar,
      );
      if (!allowed) {
        return {
          access: "join",
          calendar: toPublicCalendar(calendar),
          tiers: await deps.tiers.listByCalendar(calendar.id),
          membership: userId
            ? await deps.calendarMembers.findByUserAndCalendar(userId, calendar.id)
            : null,
          followerCount,
        };
      }
    }

    const memberView = calendar.visibility === "private";
    const events = visibleEvents(await deps.events.listByCalendar(calendar.id), memberView, clock.now());
    const featured = events.filter(
      (event) => event.isFeatured && (event.status === "published" || event.status === "scheduled"),
    );
    const tags = [...new Set([...calendar.tags, ...events.flatMap((event) => event.tags)])];
    const similar = similarCalendars(calendar, await deps.calendars.listPublic(calendar.id));

    return {
      access: "full",
      calendar: toPublicCalendar(calendar),
      eventsByMonth: groupEventsByMonth(events, calendar.locale, calendar.timezone),
      featured,
      tags,
      followerCount,
      following,
      followPreferences: follower?.preferences ?? null,
      similar: similar.map(toPublicCalendar),
      map: mapFor(calendar, events),
    };
  }

  return { getView };
}
