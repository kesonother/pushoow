import type { RegistrationStatus } from "@/domain/event/commerce-types";

export function mapGuestStatus(value: string): RegistrationStatus {
  const status = value.trim().toLowerCase();
  if (!status) return "confirmed";
  if (["going", "approved", "confirmed", "yes"].includes(status)) return "confirmed";
  if (["pending", "invited"].includes(status)) return "pending";
  if (["waitlist", "waitlisted", "pending approval"].includes(status)) return "waitlisted";
  if (["cancelled", "canceled", "declined", "no"].includes(status)) return "cancelled";
  return "confirmed";
}

export function parseTags(value: string): string[] {
  return [...new Set(value.split(/[|,]/).map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

export function importTargetKey(input: { organizationId: string; calendarId?: string | null; eventId?: string | null }) {
  return input.eventId || input.calendarId || input.organizationId;
}
