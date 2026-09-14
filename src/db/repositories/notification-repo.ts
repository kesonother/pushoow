import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  newsletter,
  notificationDelivery,
  notificationPreference,
  notificationSuppression,
  notificationTemplate,
  smsConsent,
} from "@/db/schema/notifications";
import type {
  NewsletterRepository,
  NotificationDeliveryRepository,
  NotificationPreferenceRepository,
  NotificationSuppressionRepository,
  NotificationTemplateRepository,
  SmsConsentRepository,
} from "@/domain/notification/types";

export function createDrizzleNotificationPreferenceRepository(db: Database): NotificationPreferenceRepository {
  return {
    async listByUser(userId) {
      return db.select().from(notificationPreference).where(eq(notificationPreference.userId, userId));
    },
    async upsert(preference) {
      const [row] = await db
        .insert(notificationPreference)
        .values(preference)
        .onConflictDoUpdate({
          target: [notificationPreference.userId, notificationPreference.channel, notificationPreference.category],
          set: {
            enabled: preference.enabled,
            trackingConsent: preference.trackingConsent,
            updatedAt: preference.updatedAt,
          },
        })
        .returning();
      return row;
    },
  };
}

export function createDrizzleNotificationSuppressionRepository(db: Database): NotificationSuppressionRepository {
  return {
    async find(channel, address) {
      const [row] = await db
        .select()
        .from(notificationSuppression)
        .where(and(eq(notificationSuppression.channel, channel), eq(notificationSuppression.address, address)))
        .limit(1);
      return row ?? null;
    },
    async create(item) {
      const [row] = await db.insert(notificationSuppression).values(item).returning();
      return row;
    },
  };
}

export function createDrizzleNotificationTemplateRepository(db: Database): NotificationTemplateRepository {
  return {
    async listPublished(key, channel) {
      const rows = await db
        .select()
        .from(notificationTemplate)
        .where(and(eq(notificationTemplate.key, key), eq(notificationTemplate.channel, channel)));
      return rows.map((row) => ({
        ...row,
        status: row.status === "draft" ? "draft" : "published",
      }));
    },
  };
}

export function createDrizzleNotificationDeliveryRepository(db: Database): NotificationDeliveryRepository {
  return {
    async findByIdempotencyKey(key) {
      const [row] = await db
        .select()
        .from(notificationDelivery)
        .where(eq(notificationDelivery.idempotencyKey, key))
        .limit(1);
      return row
        ? {
            ...row,
            variant: (row.variant as "a" | "b" | null) ?? null,
          }
        : null;
    },
    async create(item) {
      const [row] = await db.insert(notificationDelivery).values(item).returning();
      return { ...row, variant: (row.variant as "a" | "b" | null) ?? null };
    },
    async save(item) {
      const [row] = await db
        .update(notificationDelivery)
        .set({
          status: item.status,
          openedAt: item.openedAt,
          clickedAt: item.clickedAt,
          providerMessageId: item.providerMessageId,
        })
        .where(eq(notificationDelivery.id, item.id))
        .returning();
      return { ...row, variant: (row.variant as "a" | "b" | null) ?? null };
    },
    async listAll() {
      const rows = await db.select().from(notificationDelivery);
      return rows.map((row) => ({ ...row, variant: (row.variant as "a" | "b" | null) ?? null }));
    },
  };
}

export function createDrizzleSmsConsentRepository(db: Database): SmsConsentRepository {
  return {
    async findByPhone(phone) {
      const [row] = await db.select().from(smsConsent).where(eq(smsConsent.phone, phone)).limit(1);
      return row ?? null;
    },
    async upsert(item) {
      const [row] = await db
        .insert(smsConsent)
        .values(item)
        .onConflictDoUpdate({
          target: smsConsent.phone,
          set: {
            status: item.status,
            source: item.source,
            userId: item.userId,
            updatedAt: item.updatedAt,
          },
        })
        .returning();
      return row;
    },
  };
}

export function createDrizzleNewsletterRepository(db: Database): NewsletterRepository {
  return {
    async create(item) {
      const [row] = await db.insert(newsletter).values(item).returning();
      return { ...row, status: row.status as "draft" | "scheduled" | "sent" };
    },
    async findById(id) {
      const [row] = await db.select().from(newsletter).where(eq(newsletter.id, id)).limit(1);
      return row ? { ...row, status: row.status as "draft" | "scheduled" | "sent" } : null;
    },
    async listByCalendar(calendarId) {
      const rows = await db.select().from(newsletter).where(eq(newsletter.calendarId, calendarId));
      return rows.map((row) => ({ ...row, status: row.status as "draft" | "scheduled" | "sent" }));
    },
    async save(item) {
      const [row] = await db
        .update(newsletter)
        .set({
          subjectA: item.subjectA,
          subjectB: item.subjectB,
          blocks: item.blocks,
          status: item.status,
          updatedAt: item.updatedAt,
        })
        .where(eq(newsletter.id, item.id))
        .returning();
      return { ...row, status: row.status as "draft" | "scheduled" | "sent" };
    },
  };
}
