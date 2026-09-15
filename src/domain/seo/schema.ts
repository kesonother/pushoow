import type { Event } from "@/domain/event/types";
import type { Calendar } from "@/domain/calendar/types";
import { absoluteUrl } from "@/lib/public-url";

export type JsonLd = Record<string, unknown>;

export function serializeJsonLd(value: JsonLd): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function eventStatus(event: Event): string {
  if (event.status === "cancelled") return "https://schema.org/EventCancelled";
  if (event.status === "postponed") return "https://schema.org/EventPostponed";
  if (event.status === "ended") return "https://schema.org/EventScheduled";
  return "https://schema.org/EventScheduled";
}

function attendanceMode(event: Event): string {
  if (event.locationKind === "virtual") return "https://schema.org/OnlineEventAttendanceMode";
  if (event.locationKind === "hybrid") return "https://schema.org/MixedEventAttendanceMode";
  return "https://schema.org/OfflineEventAttendanceMode";
}

function location(event: Event): JsonLd | JsonLd[] | undefined {
  const place =
    event.venueName || event.venueAddress || event.city
      ? {
          "@type": "Place",
          name: event.venueName ?? event.city ?? "Venue",
          address: event.venueAddress ?? [event.city, event.country].filter(Boolean).join(", ") ?? undefined,
        }
      : undefined;
  const online =
    event.virtualUrl && (event.locationKind === "virtual" || event.locationKind === "hybrid")
      ? { "@type": "VirtualLocation", url: event.virtualUrl }
      : undefined;
  if (place && online) return [place, online];
  return online ?? place;
}

export function eventJsonLd(input: {
  event: Event;
  calendarName?: string;
  origin?: string;
  remaining?: number | null;
}): JsonLd {
  const url = absoluteUrl(`/e/${input.event.slug}`, input.origin);
  const image = input.event.coverImageUrl ? [input.event.coverImageUrl] : undefined;
  const free = !input.event.isPaid;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: input.event.title,
    description: input.event.description ?? input.event.title,
    startDate: input.event.startsAt.toISOString(),
    endDate: input.event.endsAt.toISOString(),
    eventStatus: eventStatus(input.event),
    eventAttendanceMode: attendanceMode(input.event),
    url,
    image,
    organizer: input.calendarName
      ? { "@type": "Organization", name: input.calendarName }
      : undefined,
    location: location(input.event),
    offers: {
      "@type": "Offer",
      url,
      availability:
        input.remaining === 0 ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      price: free ? 0 : undefined,
      priceCurrency: free ? "EUR" : undefined,
    },
  };
}

export function calendarJsonLd(input: {
  calendar: Pick<Calendar, "slug" | "name" | "description" | "logoUrl" | "bannerUrl" | "socialLink">;
  origin?: string;
}): JsonLd {
  const url = absoluteUrl(`/c/${input.calendar.slug}`, input.origin);
  return {
    "@context": "https://schema.org",
    "@type": "EventSeries",
    name: input.calendar.name,
    description: input.calendar.description ?? input.calendar.name,
    url,
    image: input.calendar.logoUrl ?? input.calendar.bannerUrl ?? undefined,
    organizer: {
      "@type": "Organization",
      name: input.calendar.name,
      url,
      logo: input.calendar.logoUrl ?? undefined,
      sameAs: input.calendar.socialLink ? [input.calendar.socialLink] : undefined,
    },
  };
}
