import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { aiConsent, aiGeneration, aiOrgPolicy } from "@/db/schema/ai";
import type {
  AIConsentRepository,
  AIGenerationRecord,
  AIGenerationRepository,
  AIOrgPolicy,
  AIPolicyRepository,
  AIPrivacySettings,
} from "@/domain/ai/types";

function mapGeneration(row: typeof aiGeneration.$inferSelect): AIGenerationRecord {
  return {
    id: row.id,
    organizationId: row.organizationId ?? null,
    actorUserId: row.actorUserId ?? null,
    kind: row.kind,
    providerId: row.providerId,
    model: row.model,
    inputHash: row.inputHash,
    outputSummary: row.outputSummary,
    aiGenerated: true,
    trainingAllowed: row.trainingAllowed,
    createdAt: row.createdAt,
  };
}

function mapConsent(row: typeof aiConsent.$inferSelect): AIPrivacySettings {
  return {
    userId: row.userId,
    processingOptOut: row.processingOptOut,
    trainingConsent: row.trainingConsent,
    disclosureAcknowledged: row.disclosureAcknowledged,
    updatedAt: row.updatedAt,
  };
}

function mapPolicy(row: typeof aiOrgPolicy.$inferSelect): AIOrgPolicy {
  return {
    organizationId: row.organizationId,
    optedOut: row.optedOut,
    trainingAllowed: row.trainingAllowed,
    providerRetentionDays: row.providerRetentionDays,
    disclosureVersion: row.disclosureVersion,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleAIGenerationRepository(db: Database): AIGenerationRepository {
  return {
    async create(item) {
      const [row] = await db.insert(aiGeneration).values(item).returning();
      return mapGeneration(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(aiGeneration).where(eq(aiGeneration.id, id)).limit(1);
      return row ? mapGeneration(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(aiGeneration)
        .where(eq(aiGeneration.organizationId, organizationId))
        .orderBy(desc(aiGeneration.createdAt));
      return rows.map(mapGeneration);
    },
  };
}

export function createDrizzleAIConsentRepository(db: Database): AIConsentRepository {
  return {
    async findByUser(userId) {
      const [row] = await db.select().from(aiConsent).where(eq(aiConsent.userId, userId)).limit(1);
      return row ? mapConsent(row) : null;
    },
    async upsert(item) {
      const [row] = await db
        .insert(aiConsent)
        .values(item)
        .onConflictDoUpdate({
          target: aiConsent.userId,
          set: {
            processingOptOut: item.processingOptOut,
            trainingConsent: item.trainingConsent,
            disclosureAcknowledged: item.disclosureAcknowledged,
            updatedAt: item.updatedAt,
          },
        })
        .returning();
      return mapConsent(row!);
    },
  };
}

export function createDrizzleAIPolicyRepository(db: Database): AIPolicyRepository {
  return {
    async findByOrganization(organizationId) {
      const [row] = await db.select().from(aiOrgPolicy).where(eq(aiOrgPolicy.organizationId, organizationId)).limit(1);
      return row ? mapPolicy(row) : null;
    },
    async upsert(item) {
      const [row] = await db
        .insert(aiOrgPolicy)
        .values(item)
        .onConflictDoUpdate({
          target: aiOrgPolicy.organizationId,
          set: {
            optedOut: item.optedOut,
            trainingAllowed: item.trainingAllowed,
            providerRetentionDays: item.providerRetentionDays,
            disclosureVersion: item.disclosureVersion,
            updatedAt: item.updatedAt,
          },
        })
        .returning();
      return mapPolicy(row!);
    },
  };
}
