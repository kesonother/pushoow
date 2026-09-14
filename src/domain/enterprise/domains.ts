import { ConflictError, ValidationError } from "@/domain/errors";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import type { MembershipRepository, OrganizationMember } from "@/domain/organization/types";
import type { OrganizationRole } from "@/domain/rbac/roles";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { randomToken, sha256 } from "@/lib/token-crypto";

export const ORGANIZATION_DOMAIN_KINDS = ["email", "site"] as const;
export type OrganizationDomainKind = (typeof ORGANIZATION_DOMAIN_KINDS)[number];

export type OrganizationDomain = {
  id: string;
  organizationId: string;
  domain: string;
  kind: OrganizationDomainKind;
  tokenHash: string;
  verifiedAt: Date | null;
  autoJoin: boolean;
  autoJoinRole: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
};

export type DomainRepository = {
  create: (domain: OrganizationDomain) => Promise<OrganizationDomain>;
  findByDomain: (domain: string) => Promise<OrganizationDomain | null>;
  listByOrganization: (organizationId: string) => Promise<OrganizationDomain[]>;
  save: (domain: OrganizationDomain) => Promise<OrganizationDomain>;
};

export function createDomainService(deps: {
  domains: DomainRepository;
  members: MembershipRepository;
  clock?: Clock;
  ids?: IdGenerator;
}) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function listDomains(actor: Actor) {
    assertPermission(actor, "organization:read");
    return deps.domains.listByOrganization(actor.organizationId);
  }

  async function addDomain(
    actor: Actor,
    domainName: string,
    kind: OrganizationDomainKind = "email",
  ) {
    assertPermission(actor, "organization:update");
    const domain = domainName.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      throw new ValidationError("Invalid domain");
    }
    const existing = await deps.domains.findByDomain(domain);
    if (existing) {
      throw new ConflictError("This domain is already claimed");
    }
    const now = clock.now();
    const token = randomToken();
    const record = await deps.domains.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      domain,
      kind,
      tokenHash: sha256(token),
      verifiedAt: null,
      autoJoin: false,
      autoJoinRole: "read_only",
      createdAt: now,
      updatedAt: now,
    });
    return { domain: record, verificationToken: token };
  }

  async function verifyDomain(actor: Actor, domainId: string, token: string) {
    assertPermission(actor, "organization:update");
    const records = await deps.domains.listByOrganization(actor.organizationId);
    const record = records.find((item) => item.id === domainId);
    if (!record || record.tokenHash !== sha256(token)) {
      throw new ValidationError("Domain verification failed");
    }
    const now = clock.now();
    return deps.domains.save({ ...record, verifiedAt: now, updatedAt: now });
  }

  async function tryAutoJoin(input: {
    userId: string;
    email: string;
  }): Promise<OrganizationMember | null> {
    const domainName = input.email.split("@")[1]?.toLowerCase();
    if (!domainName) return null;
    const record = await deps.domains.findByDomain(domainName);
    if (!record?.verifiedAt || !record.autoJoin || record.kind !== "email") return null;
    const already = await deps.members.findByUserAndOrganization(
      input.userId,
      record.organizationId,
    );
    if (already) return already;
    const now = clock.now();
    return deps.members.create({
      id: ids.id(),
      organizationId: record.organizationId,
      userId: input.userId,
      role: record.autoJoinRole,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { listDomains, addDomain, verifyDomain, tryAutoJoin };
}
