import { ValidationError } from "@/domain/errors";
import type { Event, EventDateChange, EventStatus } from "@/domain/event/types";
import { isPublishStatus } from "@/domain/event/types";

const TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ["published", "scheduled", "cancelled"],
  published: ["scheduled", "live", "ended", "cancelled", "postponed", "draft"],
  scheduled: ["published", "live", "ended", "cancelled", "postponed", "draft"],
  live: ["ended", "cancelled", "postponed"],
  ended: [],
  cancelled: [],
  postponed: ["scheduled", "published", "cancelled"],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransition(from, to)) {
    throw new ValidationError(`Cannot move an event from ${from} to ${to}`);
  }
}

export function resolveLifecycle(event: Event, now: Date): EventStatus {
  if (
    event.status === "cancelled" ||
    event.status === "postponed" ||
    event.status === "draft" ||
    event.status === "ended"
  ) {
    return event.status;
  }
  if (now >= event.endsAt) return "ended";
  if (now >= event.startsAt) return "live";
  return event.status === "published" ? "scheduled" : event.status;
}

export function recordDateChange(
  event: Event,
  nextStartsAt: Date,
  nextEndsAt: Date,
  changedAt: Date,
): EventDateChange[] {
  if (
    event.startsAt.getTime() === nextStartsAt.getTime() &&
    event.endsAt.getTime() === nextEndsAt.getTime()
  ) {
    return event.dateHistory;
  }
  return [
    ...event.dateHistory,
    {
      fromStartsAt: event.startsAt.toISOString(),
      fromEndsAt: event.endsAt.toISOString(),
      toStartsAt: nextStartsAt.toISOString(),
      toEndsAt: nextEndsAt.toISOString(),
      changedAt: changedAt.toISOString(),
    },
  ];
}

export function requiresPublishPermission(status: EventStatus | undefined): boolean {
  return Boolean(status && isPublishStatus(status));
}
