import {
  FEATURED_MIN_ATTENDANCE,
  FEATURED_MIN_EVENTS,
  FEATURED_MIN_FOLLOWERS,
  type FeaturedCalendarCard,
} from "@/domain/discovery/types";
import { isPublishStatus, type Event } from "@/domain/event/types";
import type { Calendar } from "@/domain/calendar/types";

export function averageAttendance(
  events: Event[],
  takenByEvent: Map<string, number>,
): number | null {
  const usable = events.filter((event) => event.capacity != null && event.capacity > 0);
  if (usable.length === 0) return null;
  const ratio =
    usable.reduce((sum, event) => {
      const taken = takenByEvent.get(event.id) ?? 0;
      return sum + Math.min(1, taken / (event.capacity as number));
    }, 0) / usable.length;
  return ratio;
}

export function isFeaturedEligible(input: {
  publishedEventCount: number;
  followerCount: number;
  averageAttendance: number | null;
}): boolean {
  if (input.publishedEventCount < FEATURED_MIN_EVENTS) return false;
  return (
    input.followerCount >= FEATURED_MIN_FOLLOWERS ||
    (input.averageAttendance != null && input.averageAttendance > FEATURED_MIN_ATTENDANCE)
  );
}

export function buildFeaturedCalendars(
  calendars: Calendar[],
  events: Event[],
  followerCounts: Map<string, number>,
  takenByEvent: Map<string, number>,
): FeaturedCalendarCard[] {
  return calendars
    .filter((calendar) => calendar.visibility === "public" && !calendar.deletedAt)
    .flatMap((calendar) => {
      const published = events.filter(
        (event) =>
          event.calendarId === calendar.id &&
          !event.deletedAt &&
          event.visibility === "public" &&
          isPublishStatus(event.status),
      );
      const attendance = averageAttendance(published, takenByEvent);
      const followerCount = followerCounts.get(calendar.id) ?? 0;
      if (
        !isFeaturedEligible({
          publishedEventCount: published.length,
          followerCount,
          averageAttendance: attendance,
        })
      ) {
        return [];
      }
      return [
        {
          id: calendar.id,
          slug: calendar.slug,
          name: calendar.name,
          description: calendar.description,
          tags: calendar.tags,
          publishedEventCount: published.length,
          followerCount,
          averageAttendance: attendance,
          buyable: false as const,
        },
      ];
    })
    .sort((a, b) => b.followerCount - a.followerCount || b.publishedEventCount - a.publishedEventCount);
}
