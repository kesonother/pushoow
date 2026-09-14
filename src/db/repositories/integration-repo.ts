import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { integrationConnection, integrationExternalRef } from "@/db/schema/integrations";
import type {
  IntegrationConnection,
  IntegrationConnectionRepository,
  IntegrationExternalRef,
  IntegrationRefRepository,
} from "@/domain/integration/types";

function toConnection(row: typeof integrationConnection.$inferSelect): IntegrationConnection {
  return {
    ...row,
    scopes: row.scopes ?? [],
    externalAccountId: row.externalAccountId ?? null,
    lastSyncAt: row.lastSyncAt ?? null,
    lastError: row.lastError ?? null,
  };
}

export function createDrizzleIntegrationConnectionRepository(db: Database): IntegrationConnectionRepository {
  return {
    async create(item) {
      const [row] = await db.insert(integrationConnection).values(item).returning();
      return toConnection(row!);
    },
    async findById(id) {
      const [row] = await db
        .select()
        .from(integrationConnection)
        .where(eq(integrationConnection.id, id))
        .limit(1);
      return row ? toConnection(row) : null;
    },
    async findByProvider(organizationId, provider) {
      const [row] = await db
        .select()
        .from(integrationConnection)
        .where(
          and(
            eq(integrationConnection.organizationId, organizationId),
            eq(integrationConnection.provider, provider),
          ),
        )
        .limit(1);
      return row ? toConnection(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(integrationConnection)
        .where(eq(integrationConnection.organizationId, organizationId));
      return rows.map(toConnection);
    },
    async save(item) {
      const [row] = await db
        .update(integrationConnection)
        .set(item)
        .where(eq(integrationConnection.id, item.id))
        .returning();
      return toConnection(row!);
    },
    async delete(id) {
      await db.delete(integrationConnection).where(eq(integrationConnection.id, id));
    },
  };
}

export function createDrizzleIntegrationRefRepository(db: Database): IntegrationRefRepository {
  return {
    async find(organizationId, provider, objectType, localId) {
      const [row] = await db
        .select()
        .from(integrationExternalRef)
        .where(
          and(
            eq(integrationExternalRef.organizationId, organizationId),
            eq(integrationExternalRef.provider, provider),
            eq(integrationExternalRef.objectType, objectType),
            eq(integrationExternalRef.localId, localId),
          ),
        )
        .limit(1);
      return (row as IntegrationExternalRef | undefined) ?? null;
    },
    async save(item) {
      const existing = await this.find(item.organizationId, item.provider, item.objectType, item.localId);
      if (existing) {
        const [row] = await db
          .update(integrationExternalRef)
          .set(item)
          .where(eq(integrationExternalRef.id, existing.id))
          .returning();
        return row as IntegrationExternalRef;
      }
      const [row] = await db.insert(integrationExternalRef).values(item).returning();
      return row as IntegrationExternalRef;
    },
  };
}
