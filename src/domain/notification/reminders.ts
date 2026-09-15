import { formatEventDateTime } from "@/i18n/datetime";

const HOUR_MS = 60 * 60 * 1000;

export const REMINDER_OFFSETS = {
  reminder_24h: 24 * HOUR_MS,
  reminder_1h: 1 * HOUR_MS,
} as const;

export type ReminderKey = keyof typeof REMINDER_OFFSETS;

export function reminderInstant(startsAt: Date, offsetMs: number): Date {
  return new Date(startsAt.getTime() - offsetMs);
}

export function reminderSchedule(startsAt: Date, timezone: string): Array<{ key: ReminderKey; sendAt: Date; timezone: string }> {
  if (!timezone.trim()) {
    throw new Error("Event timezone is required to schedule reminders");
  }
  return (Object.entries(REMINDER_OFFSETS) as Array<[ReminderKey, number]>).map(([key, offset]) => ({
    key,
    sendAt: reminderInstant(startsAt, offset),
    timezone,
  }));
}

export function formatInTimezone(date: Date, timeZone: string, locale = "en"): string {
  return formatEventDateTime(date, timeZone, locale);
}
