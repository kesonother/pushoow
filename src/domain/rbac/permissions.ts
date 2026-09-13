import { ForbiddenError } from "@/domain/errors";
import type { OrganizationRole } from "@/domain/rbac/roles";

export const PERMISSIONS = [
  "organization:read",
  "organization:update",
  "organization:delete",
  "members:read",
  "members:invite",
  "members:update",
  "members:remove",
  "calendars:create",
  "calendars:update",
  "calendars:delete",
  "events:create",
  "events:update",
  "events:delete",
  "events:publish",
  "checkin:manage",
  "finance:read",
  "finance:write",
  "subscribers:read",
  "subscribers:manage",
  "registrants:read",
  "registrants:manage",
  "exports:create",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS = [...PERMISSIONS];

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((permission) => permission !== "organization:delete"),
  editor: [
    "organization:read",
    "members:read",
    "calendars:update",
    "events:create",
    "events:update",
    "events:delete",
    "events:publish",
    "subscribers:read",
    "registrants:read",
    "registrants:manage",
    "exports:create",
  ],
  check_in_manager: [
    "organization:read",
    "checkin:manage",
    "registrants:read",
  ],
  finance: [
    "organization:read",
    "members:read",
    "finance:read",
    "finance:write",
    "registrants:read",
    "exports:create",
    "audit:read",
  ],
  read_only: [
    "organization:read",
    "members:read",
    "subscribers:read",
    "registrants:read",
    "finance:read",
    "audit:read",
  ],
};

export function permissionsFor(role: OrganizationRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: OrganizationRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: OrganizationRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(`Role '${role}' cannot perform '${permission}'`);
  }
}

export type Actor = {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  emailVerified?: boolean;
};
