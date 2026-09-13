import { ForbiddenError, NotFoundError } from "@/domain/errors";
import type { Actor, Permission } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { isOrganizationRole } from "@/domain/rbac/roles";
import type { MembershipRepository } from "@/domain/organization/types";
import type { CalendarRepository } from "@/domain/calendar/types";

export async function resolveActor(
  memberships: MembershipRepository,
  userId: string,
  organizationId: string,
  emailVerified = false,
): Promise<Actor> {
  const membership = await memberships.findByUserAndOrganization(
    userId,
    organizationId,
  );
  if (!membership || !isOrganizationRole(membership.role)) {
    throw new ForbiddenError("You are not a member of this organization");
  }

  return {
    userId,
    organizationId: membership.organizationId,
    role: membership.role,
    emailVerified,
  };
}

export async function resolveCalendarActor(
  deps: {
    memberships: MembershipRepository;
    calendars: CalendarRepository;
  },
  userId: string,
  calendarId: string,
  emailVerified = false,
): Promise<Actor> {
  const calendar = await deps.calendars.findById(calendarId);
  if (!calendar || calendar.deletedAt) {
    throw new NotFoundError("Calendar", calendarId);
  }
  return resolveActor(deps.memberships, userId, calendar.organizationId, emailVerified);
}

export function requireActorPermission(actor: Actor, permission: Permission): Actor {
  assertPermission(actor.role, permission);
  return actor;
}
