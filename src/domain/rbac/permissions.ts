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
  "integrations:manage",
  "agency:manage_clients",
  "support:read",
  "support:write",
  "support:manage",
  "ai:use",
  "ai:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS = [...PERMISSIONS];

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((permission) => permission !== "organization:delete"),
  custom: ["organization:read"],
  editor: [
    "organization:read",
    "members:read",
    "calendars:update",
    "events:create",
    "events:update",
    "events:delete",
    "events:publish",
    "subscribers:read",
    "checkin:manage",
    "registrants:read",
    "registrants:manage",
    "exports:create",
    "support:read",
    "support:write",
    "ai:use",
    "ai:read",
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
    "support:read",
    "support:write",
    "ai:read",
  ],
  read_only: [
    "organization:read",
    "members:read",
    "subscribers:read",
    "registrants:read",
    "finance:read",
    "audit:read",
    "support:read",
  ],
};

export type Actor = {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  emailVerified?: boolean;
  customRoleId?: string | null;
  permissions?: Permission[];
  viaAgency?: boolean;
  agencyOrganizationId?: string | null;
};

export type RoleOrActor = OrganizationRole | Pick<Actor, "role" | "permissions">;

export function permissionsFor(role: OrganizationRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function effectivePermissions(roleOrActor: RoleOrActor): readonly Permission[] {
  if (typeof roleOrActor === "object") {
    if (roleOrActor.permissions) return roleOrActor.permissions;
    return permissionsFor(roleOrActor.role);
  }
  return permissionsFor(roleOrActor);
}

export function hasPermission(roleOrActor: RoleOrActor, permission: Permission): boolean {
  return effectivePermissions(roleOrActor).includes(permission);
}

export function assertPermission(roleOrActor: RoleOrActor, permission: Permission): void {
  if (!hasPermission(roleOrActor, permission)) {
    const role = typeof roleOrActor === "object" ? roleOrActor.role : roleOrActor;
    throw new ForbiddenError(`Role '${role}' cannot perform '${permission}'`);
  }
}
