import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import {
  organizationDefaults,
  type AgencyClientRepository,
  type Organization,
  type OrganizationRepository,
} from "@/domain/organization/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { slugFromName } from "@/lib/slug";

export type AgencyServiceDeps = {
  organizations: OrganizationRepository;
  agencyClients: AgencyClientRepository;
  clock?: Clock;
  ids?: IdGenerator;
};

export function createAgencyService(deps: AgencyServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function requireAgency(actor: Actor): Promise<Organization> {
    assertPermission(actor, "agency:manage_clients");
    if (actor.viaAgency) {
      throw new ForbiddenError("Client organizations cannot manage other clients");
    }
    const organization = await deps.organizations.findById(actor.organizationId);
    if (!organization || organization.deletedAt) {
      throw new NotFoundError("Organization", actor.organizationId);
    }
    if (organization.kind !== "agency") {
      throw new ValidationError("Only an agency can manage client organizations");
    }
    return organization;
  }

  async function convertToAgency(actor: Actor): Promise<Organization> {
    if (actor.role !== "owner" || actor.viaAgency) {
      throw new ForbiddenError("Only an organization owner can convert to an agency");
    }
    const organization = await deps.organizations.findById(actor.organizationId);
    if (!organization || organization.deletedAt) {
      throw new NotFoundError("Organization", actor.organizationId);
    }
    if (organization.kind === "client") {
      throw new ValidationError("A client organization cannot become an agency");
    }
    if (organization.kind === "agency") return organization;
    return deps.organizations.update({
      ...organization,
      kind: "agency",
      updatedAt: clock.now(),
    });
  }

  async function createClient(
    actor: Actor,
    input: { name: string; slug?: string },
  ): Promise<Organization> {
    const agency = await requireAgency(actor);
    const name = input.name.trim();
    if (name.length < 2) {
      throw new ValidationError("Organization name is too short");
    }
    const slug = input.slug ? slugFromName(input.slug) : slugFromName(name);
    const existing = await deps.organizations.findBySlug(slug);
    if (existing && !existing.deletedAt) {
      throw new ConflictError("An organization with this slug already exists", { slug });
    }

    const now = clock.now();
    const client = await deps.organizations.create({
      id: ids.id(),
      slug,
      name,
      ...organizationDefaults(),
      kind: "client",
      agencyOrganizationId: agency.id,
      billingMode: "consolidated",
      billingOrganizationId: agency.id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await deps.agencyClients.create({
      id: ids.id(),
      agencyOrganizationId: agency.id,
      clientOrganizationId: client.id,
      createdAt: now,
    });

    return client;
  }

  async function listClients(actor: Actor): Promise<Organization[]> {
    await requireAgency(actor);
    return (await deps.organizations.listByAgency(actor.organizationId)).filter(
      (item) => !item.deletedAt,
    );
  }

  return { convertToAgency, createClient, listClients };
}
