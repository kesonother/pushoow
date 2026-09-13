import type { Calendar } from "@/domain/calendar/types";
import type { CalendarMemberRepository } from "@/domain/calendar/membership-types";
import type { MembershipRepository } from "@/domain/organization/types";

export const ACTIVE_MEMBERSHIP_STATUSES = new Set(["active", "approved"]);

export type CalendarAccessDeps = {
  orgMembers: MembershipRepository;
  calendarMembers: CalendarMemberRepository;
};

export async function canViewPrivateCalendar(
  deps: CalendarAccessDeps,
  userId: string | undefined,
  calendar: Calendar,
): Promise<boolean> {
  if (!userId) return false;

  const orgMember = await deps.orgMembers.findByUserAndOrganization(
    userId,
    calendar.organizationId,
  );
  if (orgMember) return true;

  const membership = await deps.calendarMembers.findByUserAndCalendar(userId, calendar.id);
  return Boolean(membership && ACTIVE_MEMBERSHIP_STATUSES.has(membership.status));
}

export function toPublicCalendar(calendar: Calendar) {
  return {
    id: calendar.id,
    organizationId: calendar.organizationId,
    slug: calendar.slug,
    name: calendar.name,
    description: calendar.description,
    timezone: calendar.timezone,
    locale: calendar.locale,
    defaultCurrency: calendar.defaultCurrency,
    visibility: calendar.visibility,
    tags: calendar.tags,
    logoUrl: calendar.logoUrl,
    primaryColor: calendar.primaryColor,
    bannerUrl: calendar.bannerUrl,
    socialLink: calendar.socialLink,
    contactEmail: calendar.contactEmail,
    postalAddress: calendar.postalAddress,
    latitude: calendar.latitude,
    longitude: calendar.longitude,
    createdAt: calendar.createdAt,
    updatedAt: calendar.updatedAt,
    deletedAt: calendar.deletedAt,
  };
}
