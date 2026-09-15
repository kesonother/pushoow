import type { Metadata } from "next";
import type { Event } from "@/domain/event/types";
import type { Calendar } from "@/domain/calendar/types";
import { isIndexableCalendar, isIndexableEvent } from "./indexability";

function twitterAndOg(input: {
  title: string;
  description: string;
  images?: string[];
  url: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const images = input.images?.filter(Boolean);
  return {
    openGraph: {
      type: "website",
      title: input.title,
      description: input.description,
      url: input.url,
      images: images?.length ? images : undefined,
    },
    twitter: {
      card: images?.length ? "summary_large_image" : "summary",
      title: input.title,
      description: input.description,
      images: images?.length ? images : undefined,
    },
  };
}

export function eventPageMetadata(event: Event, calendar?: Pick<Calendar, "visibility" | "deletedAt"> | null): Metadata {
  const index = isIndexableEvent(event, calendar);
  const description = event.description ?? event.title;
  const images = event.coverImageUrl ? [event.coverImageUrl] : undefined;
  const url = `/e/${event.slug}`;
  return {
    title: event.title,
    description,
    alternates: { canonical: url },
    robots: { index, follow: index },
    ...twitterAndOg({ title: event.title, description, images, url }),
  };
}

export function calendarPageMetadata(
  calendar: Pick<Calendar, "name" | "description" | "slug" | "visibility" | "deletedAt" | "logoUrl" | "bannerUrl">,
): Metadata {
  const index = isIndexableCalendar(calendar);
  const description = calendar.description ?? calendar.name;
  const images = calendar.logoUrl ? [calendar.logoUrl] : calendar.bannerUrl ? [calendar.bannerUrl] : undefined;
  const url = `/c/${calendar.slug}`;
  return {
    title: calendar.name,
    description,
    alternates: { canonical: url },
    robots: { index, follow: index },
    ...twitterAndOg({ title: calendar.name, description, images, url }),
  };
}

export const noindexMetadata: Metadata = {
  robots: { index: false, follow: false },
};
