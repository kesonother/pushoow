export const ORGANIZATION_ROLES = [
  "owner",
  "admin",
  "editor",
  "check_in_manager",
  "finance",
  "read_only",
  "custom",
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export function isOrganizationRole(value: string): value is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

export const ROLE_RANK: Record<OrganizationRole, number> = {
  owner: 100,
  admin: 80,
  editor: 60,
  custom: 55,
  finance: 50,
  check_in_manager: 40,
  read_only: 10,
};

export function canAssignRole(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole,
): boolean {
  if (actorRole === "owner") return true;
  return ROLE_RANK[targetRole] < ROLE_RANK[actorRole];
}

export function canManageMember(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole,
): boolean {
  if (actorRole === "owner") return true;
  return ROLE_RANK[targetRole] < ROLE_RANK[actorRole];
}
