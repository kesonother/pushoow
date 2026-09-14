import { ForbiddenError, NotFoundError } from "@/domain/errors";
import type { Actor, Permission } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { isOrganizationRole } from "@/domain/rbac/roles";
import type { MembershipRepository } from "@/domain/organization/types";
import type { CalendarRepository } from "@/domain/calendar/types";

export type ActorResolver = {
  resolve: (
    userId: string,
    organizationId: string,
    emailVerified?: boolean,
  ) => Promise<Actor>;
};

export type ActorSource = ActorResolver | MembershipRepository;

function isResolver(source: ActorSource): source is ActorResolver {
  return "resolve" in source && typeof source.resolve === "function";
}

export async function resolveMembershipActor(
  memberships: MembershipRepository,
  userId: string,
  organizationId: string,
  emailVerified = false,
): Promise<Actor> {
  const membership = await memberships.findByUserAndOrganization(userId, organizationId);
  if (!membership || !isOrganizationRole(membership.role)) {
    throw new ForbiddenError("You are not a member of this organization");
  }

  return {
    userId,
    organizationId: membership.organizationId,
    role: membership.role,
    emailVerified,
    customRoleId: membership.customRoleId ?? null,
  };
}

export async function resolveActor(
  source: ActorSource,
  userId: string,
  organizationId: string,
  emailVerified = false,
): Promise<Actor> {
  if (isResolver(source)) {
    return source.resolve(userId, organizationId, emailVerified);
  }
  return resolveMembershipActor(source, userId, organizationId, emailVerified);
}

export async function resolveCalendarActor(
  deps: {
    memberships: ActorSource;
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
  assertPermission(actor, permission);
  return actor;
}
