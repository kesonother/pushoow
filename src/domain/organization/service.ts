import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/domain/errors";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import type {
  MembershipRepository,
  Organization,
  OrganizationRepository,
} from "@/domain/organization/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { slugFromName } from "@/lib/slug";

export type OrganizationServiceDeps = {
  organizations: OrganizationRepository;
  members: MembershipRepository;
  clock?: Clock;
  ids?: IdGenerator;
};

export function createOrganizationService(deps: OrganizationServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function createOrganization(input: {
    actorUserId: string;
    name: string;
    slug?: string;
  }): Promise<Organization> {
    if (!input.actorUserId) {
      throw new UnauthorizedError();
    }

    const name = input.name.trim();
    if (name.length < 2) {
      throw new ValidationError("Organization name is too short");
    }

    const slug = input.slug ? slugFromName(input.slug) : slugFromName(name);
    const existing = await deps.organizations.findBySlug(slug);
    if (existing && !existing.deletedAt) {
      throw new ConflictError("An organization with this slug already exists", {
        slug,
      });
    }

    const now = clock.now();
    const organization = await deps.organizations.create({
      id: ids.id(),
      slug,
      name,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await deps.members.create({
      id: ids.id(),
      organizationId: organization.id,
      userId: input.actorUserId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });

    return organization;
  }

  async function listOrganizationsForUser(userId: string): Promise<Organization[]> {
    if (!userId) {
      throw new UnauthorizedError();
    }

    const memberships = await deps.members.listByUser(userId);
    const idsForUser = memberships.map((membership) => membership.organizationId);
    const organizations = await deps.organizations.listByIds(idsForUser);
    return organizations.filter((organization) => !organization.deletedAt);
  }

  async function getOrganization(actor: Actor): Promise<Organization> {
    assertPermission(actor.role, "organization:read");
    const organization = await deps.organizations.findById(actor.organizationId);
    if (!organization || organization.deletedAt) {
      throw new NotFoundError("Organization", actor.organizationId);
    }
    return organization;
  }

  async function updateOrganization(
    actor: Actor,
    input: { name?: string; slug?: string },
  ): Promise<Organization> {
    assertPermission(actor.role, "organization:update");
    const organization = await getOrganization(actor);
    const nextName = input.name?.trim() ?? organization.name;
    const nextSlug = input.slug ? slugFromName(input.slug) : organization.slug;

    if (nextSlug !== organization.slug) {
      const existing = await deps.organizations.findBySlug(nextSlug);
      if (existing && existing.id !== organization.id && !existing.deletedAt) {
        throw new ConflictError("An organization with this slug already exists", {
          slug: nextSlug,
        });
      }
    }

    return deps.organizations.update({
      ...organization,
      name: nextName,
      slug: nextSlug,
      updatedAt: clock.now(),
    });
  }

  return {
    createOrganization,
    listOrganizationsForUser,
    getOrganization,
    updateOrganization,
  };
}
