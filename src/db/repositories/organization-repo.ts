import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  agencyClient,
  organization,
  organizationCustomRole,
  organizationMember,
} from "@/db/schema";
import { auditLog } from "@/db/schema/ops";
import { isCustomGrant } from "@/domain/rbac/grants";
import type { OrganizationRole } from "@/domain/rbac/roles";
import type { AuditLog, AuditRepository } from "@/domain/audit/types";
import type {
  AgencyClientLink,
  AgencyClientRepository,
  CustomRoleRepository,
  MembershipRepository,
  Organization,
  OrganizationCustomRole,
  OrganizationMember,
  OrganizationRepository,
} from "@/domain/organization/types";
import { organizationDefaults } from "@/domain/organization/types";

function mapOrganization(row: typeof organization.$inferSelect): Organization {
  const defaults = organizationDefaults();
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind ?? defaults.kind,
    agencyOrganizationId: row.agencyOrganizationId ?? null,
    functionalLevel: row.functionalLevel ?? defaults.functionalLevel,
    logoUrl: row.logoUrl ?? null,
    primaryColor: row.primaryColor ?? null,
    secondaryColor: row.secondaryColor ?? null,
    billingMode: row.billingMode ?? defaults.billingMode,
    billingOrganizationId: row.billingOrganizationId ?? null,
    auditRetentionDays: row.auditRetentionDays ?? defaults.auditRetentionDays,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function mapMember(row: typeof organizationMember.$inferSelect): OrganizationMember {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    role: row.role as OrganizationRole,
    customRoleId: row.customRoleId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCustomRole(row: typeof organizationCustomRole.$inferSelect): OrganizationCustomRole {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    grants: (row.grants ?? []).filter(isCustomGrant),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAgencyClient(row: typeof agencyClient.$inferSelect): AgencyClientLink {
  return {
    id: row.id,
    agencyOrganizationId: row.agencyOrganizationId,
    clientOrganizationId: row.clientOrganizationId,
    createdAt: row.createdAt,
  };
}

function mapAudit(row: typeof auditLog.$inferSelect): AuditLog {
  return {
    id: row.id,
    organizationId: row.organizationId,
    actorUserId: row.actorUserId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    metadata: row.metadata ?? null,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    before: row.before ?? null,
    after: row.after ?? null,
    requestId: row.requestId,
    createdAt: row.createdAt,
  };
}

export function createDrizzleOrganizationRepository(
  db: Database,
): OrganizationRepository {
  return {
    async create(item) {
      const [row] = await db.insert(organization).values(item).returning();
      return mapOrganization(row);
    },
    async findById(id) {
      const [row] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, id))
        .limit(1);
      return row ? mapOrganization(row) : null;
    },
    async findBySlug(slug) {
      const [row] = await db
        .select()
        .from(organization)
        .where(and(eq(organization.slug, slug), isNull(organization.deletedAt)))
        .limit(1);
      return row ? mapOrganization(row) : null;
    },
    async listByIds(ids) {
      if (ids.length === 0) return [];
      const rows = await db
        .select()
        .from(organization)
        .where(inArray(organization.id, ids));
      return rows.map(mapOrganization);
    },
    async listByAgency(agencyOrganizationId) {
      const rows = await db
        .select()
        .from(organization)
        .where(eq(organization.agencyOrganizationId, agencyOrganizationId));
      return rows.map(mapOrganization);
    },
    async listRetentionPolicies() {
      const rows = await db
        .select({
          id: organization.id,
          auditRetentionDays: organization.auditRetentionDays,
        })
        .from(organization)
        .where(isNull(organization.deletedAt));
      return rows;
    },
    async update(item) {
      const [row] = await db
        .update(organization)
        .set({
          name: item.name,
          slug: item.slug,
          kind: item.kind,
          agencyOrganizationId: item.agencyOrganizationId,
          functionalLevel: item.functionalLevel,
          logoUrl: item.logoUrl,
          primaryColor: item.primaryColor,
          secondaryColor: item.secondaryColor,
          billingMode: item.billingMode,
          billingOrganizationId: item.billingOrganizationId,
          auditRetentionDays: item.auditRetentionDays,
          updatedAt: item.updatedAt,
          deletedAt: item.deletedAt,
        })
        .where(eq(organization.id, item.id))
        .returning();
      return mapOrganization(row);
    },
  };
}

export function createDrizzleMembershipRepository(db: Database): MembershipRepository {
  return {
    async create(member) {
      const [row] = await db.insert(organizationMember).values(member).returning();
      return mapMember(row);
    },
    async findByUserAndOrganization(userId, organizationId) {
      const [row] = await db
        .select()
        .from(organizationMember)
        .where(
          and(
            eq(organizationMember.userId, userId),
            eq(organizationMember.organizationId, organizationId),
          ),
        )
        .limit(1);
      return row ? mapMember(row) : null;
    },
    async listByUser(userId) {
      const rows = await db
        .select()
        .from(organizationMember)
        .where(eq(organizationMember.userId, userId));
      return rows.map(mapMember);
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(organizationMember)
        .where(eq(organizationMember.organizationId, organizationId));
      return rows.map(mapMember);
    },
    async update(member) {
      const [row] = await db
        .update(organizationMember)
        .set({
          role: member.role,
          customRoleId: member.customRoleId ?? null,
          updatedAt: member.updatedAt,
        })
        .where(eq(organizationMember.id, member.id))
        .returning();
      return mapMember(row);
    },
    async delete(id) {
      await db.delete(organizationMember).where(eq(organizationMember.id, id));
    },
  };
}

export function createDrizzleCustomRoleRepository(db: Database): CustomRoleRepository {
  return {
    async create(role) {
      const [row] = await db.insert(organizationCustomRole).values(role).returning();
      return mapCustomRole(row);
    },
    async findById(id) {
      const [row] = await db
        .select()
        .from(organizationCustomRole)
        .where(eq(organizationCustomRole.id, id))
        .limit(1);
      return row ? mapCustomRole(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(organizationCustomRole)
        .where(eq(organizationCustomRole.organizationId, organizationId));
      return rows.map(mapCustomRole);
    },
    async save(role) {
      const [row] = await db
        .update(organizationCustomRole)
        .set({
          name: role.name,
          grants: role.grants,
          updatedAt: role.updatedAt,
        })
        .where(eq(organizationCustomRole.id, role.id))
        .returning();
      return mapCustomRole(row);
    },
    async delete(id) {
      await db.delete(organizationCustomRole).where(eq(organizationCustomRole.id, id));
    },
  };
}

export function createDrizzleAgencyClientRepository(db: Database): AgencyClientRepository {
  return {
    async create(link) {
      const [row] = await db.insert(agencyClient).values(link).returning();
      return mapAgencyClient(row);
    },
    async find(agencyOrganizationId, clientOrganizationId) {
      const [row] = await db
        .select()
        .from(agencyClient)
        .where(
          and(
            eq(agencyClient.agencyOrganizationId, agencyOrganizationId),
            eq(agencyClient.clientOrganizationId, clientOrganizationId),
          ),
        )
        .limit(1);
      return row ? mapAgencyClient(row) : null;
    },
    async listByAgency(agencyOrganizationId) {
      const rows = await db
        .select()
        .from(agencyClient)
        .where(eq(agencyClient.agencyOrganizationId, agencyOrganizationId));
      return rows.map(mapAgencyClient);
    },
    async listByClient(clientOrganizationId) {
      const rows = await db
        .select()
        .from(agencyClient)
        .where(eq(agencyClient.clientOrganizationId, clientOrganizationId));
      return rows.map(mapAgencyClient);
    },
  };
}

export function createDrizzleAuditRepository(db: Database): AuditRepository {
  return {
    async create(log) {
      const [row] = await db.insert(auditLog).values(log).returning();
      return mapAudit(row);
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.organizationId, organizationId));
      return rows.map(mapAudit);
    },
    async purgeExpired(now, policies) {
      let removed = 0;
      for (const policy of policies) {
        const cutoff = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
        const rows = await db
          .delete(auditLog)
          .where(
            and(
              eq(auditLog.organizationId, policy.organizationId),
              lt(auditLog.createdAt, cutoff),
            ),
          )
          .returning({ id: auditLog.id });
        removed += rows.length;
      }
      return removed;
    },
  };
}
