import { redirect } from "next/navigation";
import { resolveActor, type ActorSource } from "@/api/authorize";
import { canAccessFullDashboard } from "@/domain/rbac/dashboard";
import type { OrganizationRole } from "@/domain/rbac/roles";

export async function requireFullDashboardActor(
  source: ActorSource,
  userId: string,
  organizationId: string,
  emailVerified?: boolean,
) {
  const actor = await resolveActor(source, userId, organizationId, emailVerified);
  if (!canAccessFullDashboard(actor)) {
    redirect("/check-in");
  }
  return actor;
}

export function staffCanCreateOrganizations(roles: OrganizationRole[]) {
  return roles.length === 0 || roles.some((role) => canAccessFullDashboard(role));
}
