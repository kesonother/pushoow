import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  publicApiKey,
  publicOAuthClient,
  publicOAuthCode,
  publicWebhookDelivery,
  publicWebhookEndpoint,
} from "@/db/schema/public-api";
import type {
  PublicApiKey,
  PublicApiKeyRepository,
  PublicOAuthClient,
  PublicOAuthClientRepository,
  PublicOAuthCode,
  PublicOAuthCodeRepository,
  PublicWebhookDelivery,
  PublicWebhookDeliveryRepository,
  PublicWebhookEndpoint,
  PublicWebhookEndpointRepository,
} from "@/domain/public-api/types";

function toKey(row: typeof publicApiKey.$inferSelect): PublicApiKey {
  return {
    ...row,
    scopes: row.scopes ?? [],
    rateLimitPerMinute: row.rateLimitPerMinute ?? null,
    lastUsedAt: row.lastUsedAt ?? null,
    revokedAt: row.revokedAt ?? null,
  };
}

function toClient(row: typeof publicOAuthClient.$inferSelect): PublicOAuthClient {
  return {
    ...row,
    secretHash: row.secretHash ?? null,
    redirectUris: row.redirectUris ?? [],
    scopes: row.scopes ?? [],
  };
}

function toCode(row: typeof publicOAuthCode.$inferSelect): PublicOAuthCode {
  return { ...row, consumedAt: row.consumedAt ?? null };
}

function toEndpoint(row: typeof publicWebhookEndpoint.$inferSelect): PublicWebhookEndpoint {
  return { ...row, events: row.events ?? [] };
}

function toDelivery(row: typeof publicWebhookDelivery.$inferSelect): PublicWebhookDelivery {
  return {
    ...row,
    payload: row.payload ?? {},
    lastError: row.lastError ?? null,
    responseStatus: row.responseStatus ?? null,
    nextRetryAt: row.nextRetryAt ?? null,
  };
}

export function createDrizzlePublicApiKeyRepository(db: Database): PublicApiKeyRepository {
  return {
    async create(item) {
      const [row] = await db.insert(publicApiKey).values(item).returning();
      return toKey(row!);
    },
    async findByHash(keyHash) {
      const [row] = await db
        .select()
        .from(publicApiKey)
        .where(and(eq(publicApiKey.keyHash, keyHash), isNull(publicApiKey.revokedAt)))
        .limit(1);
      return row ? toKey(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db.select().from(publicApiKey).where(eq(publicApiKey.organizationId, organizationId));
      return rows.map(toKey);
    },
    async save(item) {
      const [row] = await db.update(publicApiKey).set(item).where(eq(publicApiKey.id, item.id)).returning();
      return toKey(row!);
    },
  };
}

export function createDrizzlePublicOAuthClientRepository(db: Database): PublicOAuthClientRepository {
  return {
    async create(item) {
      const [row] = await db.insert(publicOAuthClient).values(item).returning();
      return toClient(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(publicOAuthClient).where(eq(publicOAuthClient.id, id)).limit(1);
      return row ? toClient(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(publicOAuthClient)
        .where(eq(publicOAuthClient.organizationId, organizationId));
      return rows.map(toClient);
    },
  };
}

export function createDrizzlePublicOAuthCodeRepository(db: Database): PublicOAuthCodeRepository {
  return {
    async create(item) {
      const [row] = await db.insert(publicOAuthCode).values(item).returning();
      return toCode(row!);
    },
    async findByHash(codeHash) {
      const [row] = await db.select().from(publicOAuthCode).where(eq(publicOAuthCode.codeHash, codeHash)).limit(1);
      return row ? toCode(row) : null;
    },
    async save(item) {
      const [row] = await db.update(publicOAuthCode).set(item).where(eq(publicOAuthCode.id, item.id)).returning();
      return toCode(row!);
    },
  };
}

export function createDrizzlePublicWebhookEndpointRepository(db: Database): PublicWebhookEndpointRepository {
  return {
    async create(item) {
      const [row] = await db.insert(publicWebhookEndpoint).values(item).returning();
      return toEndpoint(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(publicWebhookEndpoint).where(eq(publicWebhookEndpoint.id, id)).limit(1);
      return row ? toEndpoint(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(publicWebhookEndpoint)
        .where(eq(publicWebhookEndpoint.organizationId, organizationId));
      return rows.map(toEndpoint);
    },
    async save(item) {
      const [row] = await db
        .update(publicWebhookEndpoint)
        .set(item)
        .where(eq(publicWebhookEndpoint.id, item.id))
        .returning();
      return toEndpoint(row!);
    },
  };
}

export function createDrizzlePublicWebhookDeliveryRepository(db: Database): PublicWebhookDeliveryRepository {
  return {
    async create(item) {
      const [row] = await db.insert(publicWebhookDelivery).values(item).returning();
      return toDelivery(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(publicWebhookDelivery).where(eq(publicWebhookDelivery.id, id)).limit(1);
      return row ? toDelivery(row) : null;
    },
    async listByEndpoint(endpointId) {
      const rows = await db
        .select()
        .from(publicWebhookDelivery)
        .where(eq(publicWebhookDelivery.endpointId, endpointId));
      return rows.map(toDelivery);
    },
    async save(item) {
      const [row] = await db
        .update(publicWebhookDelivery)
        .set(item)
        .where(eq(publicWebhookDelivery.id, item.id))
        .returning();
      return toDelivery(row!);
    },
  };
}
