import { isListedEventStatus, type Event } from "@/domain/event/types";
import type { Calendar } from "@/domain/calendar/types";

export function isIndexableCalendar(calendar: Pick<Calendar, "visibility" | "deletedAt">): boolean {
  return !calendar.deletedAt && calendar.visibility === "public";
}

export function isIndexableEvent(event: Event, calendar?: Pick<Calendar, "visibility" | "deletedAt"> | null): boolean {
  if (event.deletedAt) return false;
  if (event.visibility !== "public") return false;
  if (!isListedEventStatus(event.status)) return false;
  if (!calendar || calendar.deletedAt || calendar.visibility !== "public") return false;
  return true;
}

export const NOINDEX_PATH_PREFIXES = [
  "/dashboard",
  "/me",
  "/check-in",
  "/profile",
  "/privacy",
  "/login",
  "/unsubscribe",
  "/verify-email",
  "/invitations",
  "/embed",
  "/r/",
  "/api",
] as const;
