import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/domain/errors";
import { normalizeHexColor } from "@/domain/organization/branding";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import {
  AUDIT_RETENTION_MAX_DAYS,
  AUDIT_RETENTION_MIN_DAYS,
  BILLING_MODES,
  FUNCTIONAL_LEVELS,
  calendarLimitFor,
  organizationDefaults,
  type BillingMode,
  type FunctionalLevel,
  type MembershipRepository,
  type Organization,
  type OrganizationKind,
  type OrganizationRepository,
} from "@/domain/organization/types";
import type { CalendarRepository } from "@/domain/calendar/types";
import type { EntitlementResolver } from "@/domain/billing/entitlements";
import { remainingQuota } from "@/domain/billing/catalog";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { slugFromName } from "@/lib/slug";

export type OrganizationServiceDeps = {
  organizations: OrganizationRepository;
  members: MembershipRepository;
  calendars?: CalendarRepository;
  entitlements?: EntitlementResolver;
  onCreated?: (organizationId: string) => Promise<void>;
  clock?: Clock;
  ids?: IdGenerator;
};

export type OrganizationUpdateInput = {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  functionalLevel?: FunctionalLevel;
  billingMode?: BillingMode;
  auditRetentionDays?: number;
  kind?: Extract<OrganizationKind, "standard" | "agency">;
};

export function createOrganizationService(deps: OrganizationServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function calendarUsage(organizationId: string) {
    const organization = await deps.organizations.findById(organizationId);
    if (!organization || organization.deletedAt) {
      throw new NotFoundError("Organization", organizationId);
    }
    const calendars = deps.calendars
      ? (await deps.calendars.listByOrganization(organizationId)).filter(
          (calendar) => !calendar.deletedAt,
        )
      : [];
    const entitlements = deps.entitlements
      ? await deps.entitlements.forOrganization(organizationId)
      : null;
    const rawLimit = entitlements
      ? entitlements.maxCalendars
      : calendarLimitFor(organization.functionalLevel);
    const used = calendars.length;
    const limit = rawLimit < 0 ? Number.MAX_SAFE_INTEGER : rawLimit;
    return { used, limit, remaining: remainingQuota(used, rawLimit) };
  }

  async function createOrganization(input: {
    actorUserId: string;
    name: string;
    slug?: string;
    kind?: Extract<OrganizationKind, "standard" | "agency">;
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
      ...organizationDefaults(),
      kind: input.kind ?? "standard",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await deps.members.create({
      id: ids.id(),
      organizationId: organization.id,
      userId: input.actorUserId,
      role: "owner",
      customRoleId: null,
      createdAt: now,
      updatedAt: now,
    });

    await deps.onCreated?.(organization.id);

    return organization;
  }

  async function listOrganizationsForUser(userId: string): Promise<Organization[]> {
    if (!userId) {
      throw new UnauthorizedError();
    }

    const memberships = await deps.members.listByUser(userId);
    const idsForUser = memberships.map((membership) => membership.organizationId);
    const organizations = await deps.organizations.listByIds(idsForUser);
    const extra: Organization[] = [];
    for (const membership of memberships) {
      const org = organizations.find((item) => item.id === membership.organizationId);
      if (org?.kind === "agency" && (membership.role === "owner" || membership.role === "admin")) {
        extra.push(...(await deps.organizations.listByAgency(org.id)));
      }
    }
    const byId = new Map<string, Organization>();
    for (const organization of [...organizations, ...extra]) {
      if (!organization.deletedAt) byId.set(organization.id, organization);
    }
    return [...byId.values()];
  }

  async function getOrganization(actor: Actor): Promise<Organization> {
    assertPermission(actor, "organization:read");
    const organization = await deps.organizations.findById(actor.organizationId);
    if (!organization || organization.deletedAt) {
      throw new NotFoundError("Organization", actor.organizationId);
    }
    return organization;
  }

  async function updateOrganization(
    actor: Actor,
    input: OrganizationUpdateInput,
  ): Promise<Organization> {
    const organization = await getOrganization(actor);
    const touchesSettings =
      input.name !== undefined ||
      input.slug !== undefined ||
      input.logoUrl !== undefined ||
      input.primaryColor !== undefined ||
      input.secondaryColor !== undefined ||
      input.auditRetentionDays !== undefined;
    const touchesBilling = input.functionalLevel !== undefined || input.billingMode !== undefined;
    const touchesKind = input.kind !== undefined;

    if (touchesSettings) assertPermission(actor, "organization:update");
    if (touchesBilling) assertPermission(actor, "finance:write");
    if (touchesKind) {
      if (actor.role !== "owner" || actor.viaAgency) {
        throw new ForbiddenError("Only an organization owner can change the organization kind");
      }
      if (organization.kind === "client") {
        throw new ValidationError("A client organization cannot change kind");
      }
    }

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

    let functionalLevel = organization.functionalLevel;
    if (input.functionalLevel) {
      if (!(FUNCTIONAL_LEVELS as readonly string[]).includes(input.functionalLevel)) {
        throw new ValidationError("Invalid functional level");
      }
      functionalLevel = input.functionalLevel;
      const usage = await calendarUsage(organization.id);
      if (usage.used > calendarLimitFor(functionalLevel)) {
        throw new ValidationError("This level does not allow the current number of calendars", {
          used: usage.used,
          limit: calendarLimitFor(functionalLevel),
        });
      }
    }

    let auditRetentionDays = organization.auditRetentionDays;
    if (input.auditRetentionDays !== undefined) {
      if (
        !Number.isInteger(input.auditRetentionDays) ||
        input.auditRetentionDays < AUDIT_RETENTION_MIN_DAYS ||
        input.auditRetentionDays > AUDIT_RETENTION_MAX_DAYS
      ) {
        throw new ValidationError(
          `Audit retention must be between ${AUDIT_RETENTION_MIN_DAYS} and ${AUDIT_RETENTION_MAX_DAYS} days`,
        );
      }
      auditRetentionDays = input.auditRetentionDays;
    }

    let billingMode = organization.billingMode;
    let billingOrganizationId = organization.billingOrganizationId;
    if (input.billingMode) {
      if (!(BILLING_MODES as readonly string[]).includes(input.billingMode)) {
        throw new ValidationError("Invalid billing mode");
      }
      billingMode = input.billingMode;
      if (billingMode === "consolidated") {
        if (organization.kind !== "client" || !organization.agencyOrganizationId) {
          throw new ValidationError("Only client organizations can use consolidated billing");
        }
        billingOrganizationId = organization.agencyOrganizationId;
      } else {
        billingOrganizationId = null;
      }
    }

    return deps.organizations.update({
      ...organization,
      name: nextName,
      slug: nextSlug,
      logoUrl: input.logoUrl === undefined ? organization.logoUrl : input.logoUrl?.trim() || null,
      primaryColor:
        input.primaryColor === undefined
          ? organization.primaryColor
          : normalizeHexColor(input.primaryColor, "primaryColor"),
      secondaryColor:
        input.secondaryColor === undefined
          ? organization.secondaryColor
          : normalizeHexColor(input.secondaryColor, "secondaryColor"),
      functionalLevel,
      billingMode,
      billingOrganizationId,
      auditRetentionDays,
      kind: input.kind ?? organization.kind,
      updatedAt: clock.now(),
    });
  }

  return {
    createOrganization,
    listOrganizationsForUser,
    getOrganization,
    updateOrganization,
    calendarUsage,
  };
}
