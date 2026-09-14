import type { CachedUpcomingEvent, WidgetSnapshot } from "@/domain/mobile/types";

export function widgetSnapshotFromUpcoming(
  upcoming: CachedUpcomingEvent[],
  now: Date,
): WidgetSnapshot {
  const next = [...upcoming]
    .filter((item) => new Date(item.startsAt).getTime() >= now.getTime())
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];
  if (!next) {
    return { kind: "next_event", refresh: "pull", nextEvent: null, countdownSeconds: null };
  }
  const countdownSeconds = Math.max(0, Math.floor((new Date(next.startsAt).getTime() - now.getTime()) / 1000));
  return {
    kind: "countdown",
    refresh: "pull",
    nextEvent: {
      eventId: next.eventId,
      registrationId: next.registrationId,
      title: next.title,
      startsAt: next.startsAt,
      slug: next.slug,
    },
    countdownSeconds,
  };
}
