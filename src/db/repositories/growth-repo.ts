import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { embedImpressionDaily, referralCode, referralConversion } from "@/db/schema/growth";
import type { EmbedImpression, EmbedImpressionRepository, EmbedKind } from "@/domain/embed/types";
import type {
  ConversionStatus,
  ReferralCode,
  ReferralCodeRepository,
  ReferralConversion,
  ReferralConversionRepository,
  ReferralKind,
  RewardStatus,
} from "@/domain/referral/types";

function mapCode(row: typeof referralCode.$inferSelect): ReferralCode {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    userId: row.userId,
    organizationId: row.organizationId ?? null,
    eventId: row.eventId ?? null,
    clickCount: row.clickCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapConversion(row: typeof referralConversion.$inferSelect): ReferralConversion {
  return {
    id: row.id,
    codeId: row.codeId,
    kind: row.kind,
    referrerUserId: row.referrerUserId,
    refereeUserId: row.refereeUserId ?? null,
    refereeEmail: row.refereeEmail ?? null,
    eventId: row.eventId ?? null,
    organizationId: row.organizationId ?? null,
    visitorHash: row.visitorHash ?? null,
    status: row.status as ConversionStatus,
    rewardStatus: row.rewardStatus as RewardStatus,
    reason: row.reason ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleReferralCodeRepository(db: Database): ReferralCodeRepository {
  return {
    async create(item) {
      const [row] = await db.insert(referralCode).values(item).returning();
      return mapCode(row!);
    },
    async save(item) {
      const [row] = await db.update(referralCode).set(item).where(eq(referralCode.id, item.id)).returning();
      return mapCode(row!);
    },
    async findByCode(code) {
      const [row] = await db.select().from(referralCode).where(eq(referralCode.code, code)).limit(1);
      return row ? mapCode(row) : null;
    },
    async findOrganizerByUser(userId) {
      const [row] = await db
        .select()
        .from(referralCode)
        .where(and(eq(referralCode.userId, userId), eq(referralCode.kind, "organizer")))
        .limit(1);
      return row ? mapCode(row) : null;
    },
    async findAttendeeByUserAndEvent(userId, eventId) {
      const [row] = await db
        .select()
        .from(referralCode)
        .where(
          and(eq(referralCode.userId, userId), eq(referralCode.kind, "attendee"), eq(referralCode.eventId, eventId)),
        )
        .limit(1);
      return row ? mapCode(row) : null;
    },
  };
}

export function createDrizzleReferralConversionRepository(db: Database): ReferralConversionRepository {
  return {
    async create(item) {
      const [row] = await db.insert(referralConversion).values(item).returning();
      return mapConversion(row!);
    },
    async save(item) {
      const [row] = await db
        .update(referralConversion)
        .set(item)
        .where(eq(referralConversion.id, item.id))
        .returning();
      return mapConversion(row!);
    },
    async listByCode(codeId) {
      const rows = await db.select().from(referralConversion).where(eq(referralConversion.codeId, codeId));
      return rows.map(mapConversion);
    },
    async listByReferrer(userId) {
      const rows = await db.select().from(referralConversion).where(eq(referralConversion.referrerUserId, userId));
      return rows.map(mapConversion);
    },
    async findByRefereeAndKind(userId, kind: ReferralKind, eventId) {
      const filters = [eq(referralConversion.refereeUserId, userId), eq(referralConversion.kind, kind)];
      if (kind === "attendee" && eventId) filters.push(eq(referralConversion.eventId, eventId));
      const [row] = await db
        .select()
        .from(referralConversion)
        .where(and(...filters))
        .limit(1);
      return row ? mapConversion(row) : null;
    },
  };
}

function mapImpression(row: typeof embedImpressionDaily.$inferSelect): EmbedImpression {
  return {
    id: row.id,
    kind: row.kind,
    resourceId: row.resourceId,
    day: row.day,
    views: row.views,
  };
}

export function createDrizzleEmbedImpressionRepository(db: Database): EmbedImpressionRepository {
  return {
    async increment(input) {
      const [existing] = await db
        .select()
        .from(embedImpressionDaily)
        .where(
          and(
            eq(embedImpressionDaily.kind, input.kind),
            eq(embedImpressionDaily.resourceId, input.resourceId),
            eq(embedImpressionDaily.day, input.day),
          ),
        )
        .limit(1);
      if (existing) {
        const [row] = await db
          .update(embedImpressionDaily)
          .set({ views: sql`${embedImpressionDaily.views} + 1` })
          .where(eq(embedImpressionDaily.id, existing.id))
          .returning();
        return mapImpression(row!);
      }
      const [row] = await db
        .insert(embedImpressionDaily)
        .values({ ...input, views: 1 })
        .returning();
      return mapImpression(row!);
    },
    async listByResource(kind: EmbedKind, resourceId: string) {
      const rows = await db
        .select()
        .from(embedImpressionDaily)
        .where(and(eq(embedImpressionDaily.kind, kind), eq(embedImpressionDaily.resourceId, resourceId)));
      return rows.map(mapImpression);
    },
  };
}
