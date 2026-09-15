import type { Permission } from "@/domain/rbac/permissions";

export const CUSTOM_GRANTS = [
  "manage_events",
  "manage_registrants",
  "manage_billing",
  "manage_integrations",
  "manage_members",
  "manage_settings",
  "manage_calendars",
  "checkin",
  "view_audit",
  "manage_support",
  "use_ai",
] as const;

export type CustomGrant = (typeof CUSTOM_GRANTS)[number];

export function isCustomGrant(value: string): value is CustomGrant {
  return (CUSTOM_GRANTS as readonly string[]).includes(value);
}

export const GRANT_PERMISSIONS: Record<CustomGrant, readonly Permission[]> = {
  manage_events: [
    "organization:read",
    "events:create",
    "events:update",
    "events:delete",
    "events:publish",
  ],
  manage_registrants: ["organization:read", "registrants:read", "registrants:manage"],
  manage_billing: ["organization:read", "finance:read", "finance:write"],
  manage_integrations: ["organization:read", "integrations:manage"],
  manage_members: [
    "organization:read",
    "members:read",
    "members:invite",
    "members:update",
    "members:remove",
  ],
  manage_settings: ["organization:read", "organization:update"],
  manage_calendars: [
    "organization:read",
    "calendars:create",
    "calendars:update",
    "calendars:delete",
  ],
  checkin: ["organization:read", "checkin:manage", "registrants:read"],
  view_audit: ["organization:read", "audit:read", "exports:create"],
  manage_support: ["organization:read", "support:read", "support:write", "support:manage"],
  use_ai: ["organization:read", "ai:use", "ai:read"],
};

export function permissionsFromGrants(grants: CustomGrant[]): Permission[] {
  const set = new Set<Permission>(["organization:read"]);
  for (const grant of grants) {
    for (const permission of GRANT_PERMISSIONS[grant]) set.add(permission);
  }
  return [...set];
}
