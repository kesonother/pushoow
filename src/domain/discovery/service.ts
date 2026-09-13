import type { Calendar, CalendarRepository } from "@/domain/calendar/types";
import type { CalendarFollowerRepository } from "@/domain/calendar/follow-types";
import type {
  EventRegistration,
  EventRegistrationRepository,
  TicketType,
  TicketTypeRepository,
} from "@/domain/event/commerce-types";
import { isListedEventStatus, type Event, type EventRepository } from "@/domain/event/types";
import type { OrganizerProfile, ProfileRepository } from "@/domain/profile/types";
import { buildFeaturedCalendars } from "@/domain/discovery/featured";
import { buildOrganizerInsights } from "@/domain/discovery/insights";
import { buildMap } from "@/domain/discovery/map";
import { searchAndFilter } from "@/domain/discovery/query";
import { recommendForViewer, recommendFromEvent } from "@/domain/discovery/recommend";
import { countInWindow, createTtlCache, trendingScore } from "@/domain/discovery/score";
import { buildSections } from "@/domain/discovery/sections";
import { formatFromLocation, type DiscoveryEventCard, type DiscoveryFilters } from "@/domain/discovery/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";

const SCORE_TTL_MS = 60_000;
const SNAPSHOT_TTL_MS = 15_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE = new Set(["pending", "confirmed", "offered", "checked_in"]);

export type DiscoveryServiceDeps = {
  events: EventRepository;
  calendars: CalendarRepository;
  registrations: EventRegistrationRepository;
  tickets: TicketTypeRepository;
  followers: CalendarFollowerRepository;
  profiles?: ProfileRepository;
  clock?: Clock;
};

function minPrice(event: Event, tickets: TicketType[]): number {
  const prices = tickets.filter((ticket) => ticket.eventId === event.id).map((ticket) => ticket.priceCents);
  if (prices.length === 0) return event.isPaid ? 1 : 0;
  return Math.min(...prices);
}

export function createDiscoveryService(deps: DiscoveryServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const scoreCache = createTtlCache<number>(SCORE_TTL_MS);
  const snapshotCache = createTtlCache<{
    cards: DiscoveryEventCard[];
    calendars: Calendar[];
    registrations: EventRegistration[];
  }>(SNAPSHOT_TTL_MS);

  async function snapshot(): Promise<{
    cards: DiscoveryEventCard[];
    calendars: Calendar[];
    registrations: EventRegistration[];
  }> {
    const cachedSnapshot = snapshotCache.get("public", clock.now());
    if (cachedSnapshot) return cachedSnapshot;
    const [events, calendars, registrations, tickets] = await Promise.all([
      deps.events.listPublic(),
      deps.calendars.listPublic(),
      deps.registrations.listAll ? deps.registrations.listAll() : Promise.resolve([]),
      deps.tickets.listAll ? deps.tickets.listAll() : Promise.resolve([]),
    ]);
    const now = clock.now();
    const calendarById = new Map(calendars.map((item) => [item.id, item]));
    const regsByEvent = new Map<string, Date[]>();
    const takenByEvent = new Map<string, number>();
    for (const registration of registrations) {
      if (!ACTIVE.has(registration.status)) continue;
      const dates = regsByEvent.get(registration.eventId) ?? [];
      dates.push(registration.createdAt);
      regsByEvent.set(registration.eventId, dates);
      takenByEvent.set(registration.eventId, (takenByEvent.get(registration.eventId) ?? 0) + registration.quantity);
    }
    const followerCache = new Map<string, number>();
    const cards: DiscoveryEventCard[] = [];
    for (const event of events) {
      if (event.deletedAt || event.visibility !== "public") continue;
      if (!isListedEventStatus(event.status) && event.status !== "ended") continue;
      const calendar = calendarById.get(event.calendarId);
      if (!calendar || calendar.deletedAt || calendar.visibility !== "public") continue;
      let followers = followerCache.get(calendar.id);
      if (followers == null) {
        followers = await deps.followers.countByCalendar(calendar.id);
        followerCache.set(calendar.id, followers);
      }
      const dates = regsByEvent.get(event.id) ?? [];
      const cacheKey = `${event.id}:${event.updatedAt.toISOString()}`;
      const cached = scoreCache.get(cacheKey, now);
      const score =
        cached ??
        trendingScore({
          recentRegs7d: countInWindow(dates, now, 7 * DAY_MS),
          previousRegs7d: countInWindow(dates, now, 7 * DAY_MS, 7 * DAY_MS),
          velocity48h: countInWindow(dates, now, 2 * DAY_MS),
          followerCount: followers,
          featured: event.isFeatured,
        });
      if (cached == null) scoreCache.set(cacheKey, score, now);
      let organizerName = calendar.name;
      if (event.organizerUserId && deps.profiles) {
        const profile: OrganizerProfile | null = await deps.profiles.getOrganizer(event.organizerUserId);
        if (profile?.displayName) organizerName = profile.displayName;
      }
      cards.push({
        event,
        calendarId: calendar.id,
        calendarName: calendar.name,
        calendarSlug: calendar.slug,
        organizerName,
        format: formatFromLocation(event.locationKind),
        minPriceCents: minPrice(event, tickets),
        trendingScore: score,
      });
    }
    const result = { cards, calendars, registrations };
    snapshotCache.set("public", result, clock.now());
    return result;
  }

  async function discover(filters: DiscoveryFilters) {
    const { cards } = await snapshot();
    return searchAndFilter(cards, filters, clock.now());
  }

  async function sections() {
    const { cards } = await snapshot();
    return buildSections(cards, clock.now());
  }

  async function map(filters: DiscoveryFilters) {
    const { cards } = await snapshot();
    return buildMap(cards, filters, clock.now());
  }

  async function featuredCalendars() {
    const { cards, calendars, registrations } = await snapshot();
    const taken = new Map<string, number>();
    for (const registration of registrations) {
      if (!ACTIVE.has(registration.status)) continue;
      taken.set(registration.eventId, (taken.get(registration.eventId) ?? 0) + registration.quantity);
    }
    const followers = new Map<string, number>();
    for (const calendar of calendars) {
      followers.set(calendar.id, await deps.followers.countByCalendar(calendar.id));
    }
    return buildFeaturedCalendars(
      calendars,
      cards.map((card) => card.event),
      followers,
      taken,
    );
  }

  async function recommend(input: { userId?: string; eventId?: string }) {
    const { cards, registrations } = await snapshot();
    const now = clock.now();
    if (input.eventId) return recommendFromEvent(cards, input.eventId, now);
    if (!input.userId) return buildSections(cards, now).trending;
    const mine = registrations.filter((item) => item.userId === input.userId && ACTIVE.has(item.status));
    const registeredEventIds = [...new Set(mine.map((item) => item.eventId))];
    const usersByEvent = new Map<string, Set<string>>();
    for (const registration of registrations) {
      if (!registration.userId || !ACTIVE.has(registration.status)) continue;
      const set = usersByEvent.get(registration.eventId) ?? new Set();
      set.add(registration.userId);
      usersByEvent.set(registration.eventId, set);
    }
    const coRegistrations = new Map<string, string[]>();
    for (const eventId of registeredEventIds) {
      const peers = usersByEvent.get(eventId) ?? new Set();
      const others = new Set<string>();
      for (const [otherId, users] of usersByEvent) {
        if (otherId === eventId) continue;
        if ([...peers].some((user) => users.has(user))) others.add(otherId);
      }
      coRegistrations.set(eventId, [...others]);
    }
    return recommendForViewer({ cards, now, registeredEventIds, coRegistrations });
  }

  async function insights(calendarId: string) {
    const { cards, calendars } = await snapshot();
    const calendar = calendars.find((item) => item.id === calendarId) ?? (await deps.calendars.findById(calendarId));
    if (!calendar) return null;
    return buildOrganizerInsights({ calendar, calendars, cards, now: clock.now() });
  }

  return { discover, sections, map, featuredCalendars, recommend, insights };
}
