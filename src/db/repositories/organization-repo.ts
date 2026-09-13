import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { organization, organizationMember } from "@/db/schema";
import type { OrganizationRole } from "@/domain/rbac/roles";
import type {
  MembershipRepository,
  Organization,
  OrganizationMember,
  OrganizationRepository,
} from "@/domain/organization/types";

function mapOrganization(row: typeof organization.$inferSelect): Organization {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
    async update(item) {
      const [row] = await db
        .update(organization)
        .set({
          name: item.name,
          slug: item.slug,
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
        .set({ role: member.role, updatedAt: member.updatedAt })
        .where(eq(organizationMember.id, member.id))
        .returning();
      return mapMember(row);
    },
    async delete(id) {
      await db.delete(organizationMember).where(eq(organizationMember.id, id));
    },
  };
}
