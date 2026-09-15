import { NotFoundError } from "@/domain/errors";
import type {
  AddOn,
  AddOnRepository,
  EventContent,
  EventContentRepository,
  TicketType,
  TicketTypeRepository,
} from "@/domain/event/commerce-types";
import { mapEmbedUrl, mapUrl } from "@/domain/event/geocoding";
import { resolveLifecycle } from "@/domain/event/lifecycle";
import { isListedEventStatus, type Event, type EventRepository } from "@/domain/event/types";
import type { Calendar, CalendarRepository } from "@/domain/calendar/types";
import type { OrganizerProfile, ProfileRepository } from "@/domain/profile/types";
import { renderMarkdown } from "@/lib/markdown";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";

export type EventPublicView = {
  event: Event;
  lifecycle: ReturnType<typeof resolveLifecycle>;
  calendar: Pick<Calendar, "id" | "name" | "slug" | "timezone" | "visibility" | "deletedAt">;
  organizer: Pick<OrganizerProfile, "displayName" | "bio" | "website" | "linkedin" | "avatarUrl"> | null;
  descriptionHtml: string;
  mapUrl: string | null;
  mapEmbedUrl: string | null;
  speakers: EventContent[];
  agenda: EventContent[];
  faqs: EventContent[];
  tickets: TicketType[];
  addOns: AddOn[];
  related: Event[];
  remaining: number | null;
};

export function createPublicEventService(deps: {
  events: EventRepository;
  calendars: CalendarRepository;
  content: EventContentRepository;
  tickets: TicketTypeRepository;
  addOns?: AddOnRepository;
  countActive: (eventId: string) => Promise<number>;
  profiles?: ProfileRepository;
  clock?: Clock;
}) {
  const clock = deps.clock ?? systemClock;

  async function getView(slug: string): Promise<EventPublicView> {
    const event = await deps.events.findBySlug(slug);
    if (!event || event.deletedAt || !isListedEventStatus(event.status) || event.visibility === "private") {
      throw new NotFoundError("Event", slug);
    }
    const calendar = await deps.calendars.findById(event.calendarId);
    if (!calendar || calendar.deletedAt) throw new NotFoundError("Calendar", event.calendarId);
    const content = await deps.content.listByEvent(event.id);
    const related = (await deps.events.listPublic(event.id))
      .filter((item) => isListedEventStatus(item.status) && item.visibility === "public")
      .filter((item) => item.tags.some((tag) => event.tags.includes(tag)) || item.calendarId === event.calendarId)
      .slice(0, 4);
    const taken = await deps.countActive(event.id);
    const organizer = event.organizerUserId
      ? await deps.profiles?.getOrganizer(event.organizerUserId)
      : null;
    return {
      event,
      lifecycle: resolveLifecycle(event, clock.now()),
      calendar: {
        id: calendar.id,
        name: calendar.name,
        slug: calendar.slug,
        timezone: calendar.timezone,
        visibility: calendar.visibility,
        deletedAt: calendar.deletedAt,
      },
      organizer: organizer
        ? {
            displayName: organizer.displayName,
            bio: organizer.bio,
            website: organizer.website,
            linkedin: organizer.linkedin,
            avatarUrl: organizer.avatarUrl,
          }
        : null,
      descriptionHtml: event.description ? renderMarkdown(event.description) : "",
      mapUrl: mapUrl(event.latitude, event.longitude, event.venueAddress),
      mapEmbedUrl: mapEmbedUrl(event.latitude, event.longitude),
      speakers: content.filter((item) => item.kind === "speaker"),
      agenda: content.filter((item) => item.kind === "agenda"),
      faqs: content.filter((item) => item.kind === "faq"),
      tickets: await deps.tickets.listByEvent(event.id),
      addOns: deps.addOns ? await deps.addOns.listByEvent(event.id) : [],
      related,
      remaining: event.capacity == null ? null : Math.max(0, event.capacity - taken),
    };
  }

  return { getView };
}
