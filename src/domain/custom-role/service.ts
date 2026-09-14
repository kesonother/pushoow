import { ConflictError, ValidationError } from "@/domain/errors";
import { isCustomGrant, type CustomGrant } from "@/domain/rbac/grants";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type {
  CustomRoleRepository,
  MembershipRepository,
  OrganizationCustomRole,
} from "@/domain/organization/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export type CustomRoleServiceDeps = {
  roles: CustomRoleRepository;
  members: MembershipRepository;
  clock?: Clock;
  ids?: IdGenerator;
};

function parseGrants(grants: string[]): CustomGrant[] {
  if (grants.length === 0) {
    throw new ValidationError("A custom role needs at least one grant");
  }
  const unique = [...new Set(grants)];
  if (!unique.every(isCustomGrant)) {
    throw new ValidationError("One or more grants are invalid");
  }
  return unique as CustomGrant[];
}

export function createCustomRoleService(deps: CustomRoleServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function list(actor: Actor): Promise<OrganizationCustomRole[]> {
    assertPermission(actor, "members:read");
    return deps.roles.listByOrganization(actor.organizationId);
  }

  async function getInTenant(actor: Actor, roleId: string): Promise<OrganizationCustomRole> {
    const role = await deps.roles.findById(roleId);
    assertSameTenant(role, actor.organizationId, "CustomRole");
    return role as OrganizationCustomRole;
  }

  async function create(
    actor: Actor,
    input: { name: string; grants: string[] },
  ): Promise<OrganizationCustomRole> {
    assertPermission(actor, "members:update");
    const name = input.name.trim();
    if (name.length < 2) {
      throw new ValidationError("Role name is too short");
    }
    const now = clock.now();
    return deps.roles.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      name,
      grants: parseGrants(input.grants),
      createdAt: now,
      updatedAt: now,
    });
  }

  async function update(
    actor: Actor,
    roleId: string,
    input: { name?: string; grants?: string[] },
  ): Promise<OrganizationCustomRole> {
    assertPermission(actor, "members:update");
    const role = await getInTenant(actor, roleId);
    const name = input.name?.trim() ?? role.name;
    if (name.length < 2) {
      throw new ValidationError("Role name is too short");
    }
    return deps.roles.save({
      ...role,
      name,
      grants: input.grants ? parseGrants(input.grants) : role.grants,
      updatedAt: clock.now(),
    });
  }

  async function remove(actor: Actor, roleId: string): Promise<void> {
    assertPermission(actor, "members:update");
    await getInTenant(actor, roleId);
    const members = await deps.members.listByOrganization(actor.organizationId);
    if (members.some((member) => member.customRoleId === roleId)) {
      throw new ConflictError("Reassign members before deleting this role");
    }
    await deps.roles.delete(roleId);
  }

  return { list, create, update, remove, getInTenant };
}
