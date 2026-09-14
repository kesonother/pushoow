import type { OrganizationRole } from "@/domain/rbac/roles";
import { effectivePermissions, type RoleOrActor } from "@/domain/rbac/permissions";

const DOOR_ONLY_PERMISSIONS = new Set(["organization:read", "checkin:manage", "registrants:read"]);

/** Check-in managers stay on the door tools and never get the full organizer dashboard. */
export function canAccessFullDashboard(roleOrActor: OrganizationRole | RoleOrActor): boolean {
  return effectivePermissions(roleOrActor).some((permission) => !DOOR_ONLY_PERMISSIONS.has(permission));
}
