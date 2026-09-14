import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import { organization } from "@/db/schema/organizations";
import { calendar } from "@/db/schema/calendars";
import type { NewsletterBlock } from "@/domain/notification/types";

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "sms",
  "whatsapp",
  "web_push",
  "mobile_push",
]);

export const notificationCategoryEnum = pgEnum("notification_category", [
  "transactional",
  "reminder",
  "event_update",
  "cancellation",
  "new_event",
  "marketing",
]);

export const notificationSuppressionReasonEnum = pgEnum("notification_suppression_reason", [
  "bounce",
  "complaint",
  "unsubscribe",
  "stop",
]);

export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", [
  "queued",
  "sent",
  "failed",
  "suppressed",
  "skipped",
]);

export const smsConsentStatusEnum = pgEnum("sms_consent_status", ["opted_in", "opted_out"]);

export const notificationPreference = pgTable(
  "notification_preference",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    category: notificationCategoryEnum("category").notNull(),
    enabled: boolean("enabled").notNull(),
    trackingConsent: boolean("tracking_consent").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("notification_preference_unique").on(table.userId, table.channel, table.category),
    index("notification_preference_user_id_idx").on(table.userId),
  ],
);

export const notificationSuppression = pgTable(
  "notification_suppression",
  {
    id: text("id").primaryKey(),
    channel: notificationChannelEnum("channel").notNull(),
    address: text("address").notNull(),
    reason: notificationSuppressionReasonEnum("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("notification_suppression_unique").on(table.channel, table.address),
    index("notification_suppression_address_idx").on(table.address),
  ],
);

export const notificationTemplate = pgTable(
  "notification_template",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    locale: text("locale").notNull().default("en"),
    version: integer("version").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    status: text("status").notNull().default("published"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("notification_template_version_unique").on(table.key, table.channel, table.locale, table.version),
  ],
);

export const notificationDelivery = pgTable(
  "notification_delivery",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    channel: notificationChannelEnum("channel").notNull(),
    category: notificationCategoryEnum("category").notNull(),
    templateKey: text("template_key").notNull(),
    to: text("to").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    status: notificationDeliveryStatusEnum("status").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    providerMessageId: text("provider_message_id"),
    variant: text("variant"),
    openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }),
    clickedAt: timestamp("clicked_at", { withTimezone: true, mode: "date" }),
    trackingEnabled: boolean("tracking_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("notification_delivery_idempotency_unique").on(table.idempotencyKey),
    index("notification_delivery_to_idx").on(table.to),
  ],
);

export const smsConsent = pgTable(
  "sms_consent",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    phone: text("phone").notNull(),
    status: smsConsentStatusEnum("status").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [unique("sms_consent_phone_unique").on(table.phone)],
);

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    endpoint: text("endpoint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("push_subscription_endpoint_unique").on(table.endpoint),
    index("push_subscription_user_id_idx").on(table.userId),
  ],
);

export const newsletter = pgTable(
  "newsletter",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    subjectA: text("subject_a").notNull(),
    subjectB: text("subject_b"),
    blocks: jsonb("blocks").$type<NewsletterBlock[]>().notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("newsletter_calendar_id_idx").on(table.calendarId)],
);
