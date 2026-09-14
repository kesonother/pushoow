import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  analyticsPlan,
  analyticsSnapshot,
  eventPageViewDaily,
  eventPageViewVisitor,
  registrationAttribution,
} from "@/db/schema/analytics";
import type {
  AnalyticsPlanRepository,
  AttributionRepository,
  PageViewRepository,
  SnapshotRepository,
} from "@/domain/analytics/types";
import { cuidGenerator } from "@/lib/ids";

export function createDrizzleAttributionRepository(db: Database): AttributionRepository {
  return {
    async findByRegistration(registrationId) {
      const [row] = await db
        .select()
        .from(registrationAttribution)
        .where(eq(registrationAttribution.registrationId, registrationId))
        .limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(registrationAttribution).where(eq(registrationAttribution.eventId, eventId));
    },
    async listByOrganization(organizationId) {
      return db
        .select()
        .from(registrationAttribution)
        .where(eq(registrationAttribution.organizationId, organizationId));
    },
    async save(item) {
      const [row] = await db
        .insert(registrationAttribution)
        .values(item)
        .onConflictDoUpdate({
          target: registrationAttribution.registrationId,
          set: {
            source: item.source,
            tags: item.tags,
            utmSource: item.utmSource,
            utmMedium: item.utmMedium,
            utmCampaign: item.utmCampaign,
          },
        })
        .returning();
      return row;
    },
  };
}

export function createDrizzlePageViewRepository(db: Database): PageViewRepository {
  return {
    async increment(input) {
      const id = `${input.eventId}:${input.day}`;
      await db
        .insert(eventPageViewDaily)
        .values({
          id,
          organizationId: input.organizationId,
          eventId: input.eventId,
          day: input.day,
          views: 1,
          uniqueVisitors: 0,
        })
        .onConflictDoUpdate({
          target: [eventPageViewDaily.eventId, eventPageViewDaily.day],
          set: { views: sql`${eventPageViewDaily.views} + 1` },
        });
      const inserted = await db
        .insert(eventPageViewVisitor)
        .values({
          id: cuidGenerator.id(),
          eventId: input.eventId,
          day: input.day,
          visitorHash: input.visitorHash,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted.length > 0) {
        await db
          .update(eventPageViewDaily)
          .set({ uniqueVisitors: sql`${eventPageViewDaily.uniqueVisitors} + 1` })
          .where(and(eq(eventPageViewDaily.eventId, input.eventId), eq(eventPageViewDaily.day, input.day)));
      }
      const [row] = await db
        .select()
        .from(eventPageViewDaily)
        .where(and(eq(eventPageViewDaily.eventId, input.eventId), eq(eventPageViewDaily.day, input.day)))
        .limit(1);
      return row;
    },
    async listByEvent(eventId) {
      return db.select().from(eventPageViewDaily).where(eq(eventPageViewDaily.eventId, eventId));
    },
    async listByOrganization(organizationId) {
      return db.select().from(eventPageViewDaily).where(eq(eventPageViewDaily.organizationId, organizationId));
    },
  };
}

export function createDrizzleSnapshotRepository(db: Database): SnapshotRepository {
  return {
    async find(scope, scopeId) {
      const [row] = await db
        .select()
        .from(analyticsSnapshot)
        .where(and(eq(analyticsSnapshot.scope, scope), eq(analyticsSnapshot.scopeId, scopeId)))
        .limit(1);
      return row ?? null;
    },
    async save(item) {
      const [row] = await db
        .insert(analyticsSnapshot)
        .values(item)
        .onConflictDoUpdate({
          target: [analyticsSnapshot.scope, analyticsSnapshot.scopeId],
          set: {
            payload: item.payload,
            computedAt: item.computedAt,
            organizationId: item.organizationId,
          },
        })
        .returning();
      return row;
    },
  };
}

export function createDrizzleAnalyticsPlanRepository(db: Database): AnalyticsPlanRepository {
  return {
    async find(organizationId) {
      const [row] = await db.select().from(analyticsPlan).where(eq(analyticsPlan.organizationId, organizationId)).limit(1);
      return row ?? null;
    },
    async save(item) {
      const [row] = await db
        .insert(analyticsPlan)
        .values(item)
        .onConflictDoUpdate({
          target: analyticsPlan.organizationId,
          set: { plan: item.plan, updatedAt: item.updatedAt },
        })
        .returning();
      return row;
    },
  };
}
