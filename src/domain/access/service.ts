import { ForbiddenError } from "@/domain/errors";
import type {
  AgencyClientRepository,
  CustomRoleRepository,
  MembershipRepository,
  Organization,
  OrganizationMember,
  OrganizationRepository,
} from "@/domain/organization/types";
import type { Actor, Permission } from "@/domain/rbac/permissions";
import { permissionsFor } from "@/domain/rbac/permissions";
import { permissionsFromGrants } from "@/domain/rbac/grants";
import { isOrganizationRole } from "@/domain/rbac/roles";

export type AccessServiceDeps = {
  members: MembershipRepository;
  organizations: OrganizationRepository;
  customRoles: CustomRoleRepository;
  agencyClients: AgencyClientRepository;
};

export type AccessibleOrganization = {
  organization: Organization;
  actor: Actor;
};

export function createAccessService(deps: AccessServiceDeps) {
  async function permissionsForMembership(member: OrganizationMember): Promise<Permission[]> {
    if (member.role === "custom" && member.customRoleId) {
      const role = await deps.customRoles.findById(member.customRoleId);
      if (role && role.organizationId === member.organizationId) {
        return permissionsFromGrants(role.grants);
      }
    }
    return [...permissionsFor(member.role)];
  }

  async function resolve(
    userId: string,
    organizationId: string,
    emailVerified = false,
  ): Promise<Actor> {
    const membership = await deps.members.findByUserAndOrganization(userId, organizationId);
    if (membership && isOrganizationRole(membership.role)) {
      return {
        userId,
        organizationId: membership.organizationId,
        role: membership.role,
        emailVerified,
        customRoleId: membership.customRoleId ?? null,
        permissions: await permissionsForMembership(membership),
      };
    }

    const target = await deps.organizations.findById(organizationId);
    if (!target || target.deletedAt || target.kind !== "client" || !target.agencyOrganizationId) {
      throw new ForbiddenError("You are not a member of this organization");
    }

    const link = await deps.agencyClients.find(target.agencyOrganizationId, target.id);
    if (!link) {
      throw new ForbiddenError("You are not a member of this organization");
    }

    const agencyMembership = await deps.members.findByUserAndOrganization(
      userId,
      target.agencyOrganizationId,
    );
    if (!agencyMembership || !isOrganizationRole(agencyMembership.role)) {
      throw new ForbiddenError("You are not a member of this organization");
    }

    const agencyPermissions = await permissionsForMembership(agencyMembership);
    if (!agencyPermissions.includes("agency:manage_clients")) {
      throw new ForbiddenError("You are not a member of this organization");
    }

    return {
      userId,
      organizationId: target.id,
      role: "admin",
      emailVerified,
      permissions: [...permissionsFor("admin")],
      viaAgency: true,
      agencyOrganizationId: target.agencyOrganizationId,
    };
  }

  async function listAccessible(
    userId: string,
    emailVerified = false,
  ): Promise<AccessibleOrganization[]> {
    const memberships = await deps.members.listByUser(userId);
    const direct = await deps.organizations.listByIds(
      memberships.map((membership) => membership.organizationId),
    );
    const extra: Organization[] = [];
    for (const membership of memberships) {
      const org = direct.find((item) => item.id === membership.organizationId);
      if (!org || org.kind !== "agency" || org.deletedAt) continue;
      const permissions = await permissionsForMembership(membership);
      if (!permissions.includes("agency:manage_clients")) continue;
      extra.push(...(await deps.organizations.listByAgency(org.id)));
    }

    const byId = new Map<string, Organization>();
    for (const organization of [...direct, ...extra]) {
      if (!organization.deletedAt) byId.set(organization.id, organization);
    }

    const result: AccessibleOrganization[] = [];
    for (const organization of byId.values()) {
      try {
        const actor = await resolve(userId, organization.id, emailVerified);
        result.push({ organization, actor });
      } catch {
        continue;
      }
    }
    return result;
  }

  return { resolve, listAccessible };
}

export type AccessService = ReturnType<typeof createAccessService>;
