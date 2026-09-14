import { and, eq, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  attendeeProfile,
  eventRegistration,
  organizerProfile,
  privacyAudit,
  privacyCcpaSettings,
  privacyConsent,
  privacyDeletionRequest,
  privacyProcessingRecord,
} from "@/db/schema";
import type {
  CcpaSettingsRepository,
  ConsentRepository,
  DeletionRequestRepository,
  PrivacyAuditRepository,
  PrivacySubjectDirectory,
  ProcessingRecordRepository,
} from "@/domain/privacy/types";

export function createDrizzlePrivacyAuditRepository(db: Database): PrivacyAuditRepository {
  return {
    async append(entry) {
      const [row] = await db.insert(privacyAudit).values(entry).returning();
      return row;
    },
    async listByActor(actorUserId) {
      return db.select().from(privacyAudit).where(eq(privacyAudit.actorUserId, actorUserId));
    },
  };
}

export function createDrizzleConsentRepository(db: Database): ConsentRepository {
  return {
    async create(item) {
      const [row] = await db.insert(privacyConsent).values(item).returning();
      return row;
    },
    async listByUser(userId) {
      return db.select().from(privacyConsent).where(eq(privacyConsent.userId, userId));
    },
  };
}

export function createDrizzleDeletionRepository(db: Database): DeletionRequestRepository {
  return {
    async create(item) {
      const [row] = await db.insert(privacyDeletionRequest).values(item).returning();
      return row;
    },
    async findOpenByUser(userId) {
      const [row] = await db
        .select()
        .from(privacyDeletionRequest)
        .where(and(eq(privacyDeletionRequest.userId, userId), eq(privacyDeletionRequest.status, "pending")))
        .limit(1);
      return row ?? null;
    },
    async listDue(now) {
      return db
        .select()
        .from(privacyDeletionRequest)
        .where(and(eq(privacyDeletionRequest.status, "pending"), lte(privacyDeletionRequest.dueAt, now)));
    },
    async save(item) {
      const [row] = await db
        .update(privacyDeletionRequest)
        .set({
          status: item.status,
          processedAt: item.processedAt,
        })
        .where(eq(privacyDeletionRequest.id, item.id))
        .returning();
      return row;
    },
  };
}

export function createDrizzleProcessingRepository(db: Database): ProcessingRecordRepository {
  return {
    async create(item) {
      const [row] = await db.insert(privacyProcessingRecord).values(item).returning();
      return row;
    },
    async listByUser(userId) {
      return db.select().from(privacyProcessingRecord).where(eq(privacyProcessingRecord.userId, userId));
    },
  };
}

export function createDrizzleCcpaRepository(db: Database): CcpaSettingsRepository {
  return {
    async findByUser(userId) {
      const [row] = await db.select().from(privacyCcpaSettings).where(eq(privacyCcpaSettings.userId, userId)).limit(1);
      return row ?? null;
    },
    async upsert(item) {
      const [row] = await db
        .insert(privacyCcpaSettings)
        .values(item)
        .onConflictDoUpdate({
          target: privacyCcpaSettings.userId,
          set: {
            saleOptOut: item.saleOptOut,
            disclosureAcknowledged: item.disclosureAcknowledged,
            updatedAt: item.updatedAt,
          },
        })
        .returning();
      return row;
    },
  };
}

export function createDrizzlePrivacySubjects(db: Database): PrivacySubjectDirectory {
  return {
    async getExportPayload(userId) {
      const [organizer] = await db.select().from(organizerProfile).where(eq(organizerProfile.userId, userId)).limit(1);
      const [attendee] = await db.select().from(attendeeProfile).where(eq(attendeeProfile.userId, userId)).limit(1);
      const registrations = await db.select().from(eventRegistration).where(eq(eventRegistration.userId, userId));
      return {
        profile: { organizer: organizer ?? null, attendee: attendee ?? null },
        registrations: registrations.map((item) => ({
          id: item.id,
          eventId: item.eventId,
          status: item.status,
          anonymous: item.anonymous,
          createdAt: item.createdAt,
        })),
      };
    },
    async eraseSubject(userId, at) {
      await db.delete(organizerProfile).where(eq(organizerProfile.userId, userId));
      await db.delete(attendeeProfile).where(eq(attendeeProfile.userId, userId));
      const rows = await db.select().from(eventRegistration).where(eq(eventRegistration.userId, userId));
      for (const row of rows) {
        await db
          .update(eventRegistration)
          .set({
            userId: null,
            email: `deleted+${row.id}@invalid.local`,
            anonymous: true,
            appearOnRoster: false,
            updatedAt: at,
          })
          .where(eq(eventRegistration.id, row.id));
      }
    },
  };
}
