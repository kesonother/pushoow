import { index, integer, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import { organization } from "@/db/schema/organizations";
import { event } from "@/db/schema/events";
import type { EmbedKind } from "@/domain/embed/types";
import type { ConversionStatus, ReferralKind, RewardStatus } from "@/domain/referral/types";

export const referralKindEnum = pgEnum("referral_kind", ["organizer", "attendee"]);
export const referralConversionStatusEnum = pgEnum("referral_conversion_status", [
  "attributed",
  "eligible",
  "granted",
  "rejected",
  "blocked",
]);
export const referralRewardStatusEnum = pgEnum("referral_reward_status", ["none", "pending", "granted"]);
export const embedKindEnum = pgEnum("embed_kind", ["calendar", "rsvp", "ticket"]);

export const referralCode = pgTable(
  "referral_code",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    kind: referralKindEnum("kind").$type<ReferralKind>().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    eventId: text("event_id").references(() => event.id, { onDelete: "set null" }),
    clickCount: integer("click_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("referral_code_code_unique").on(table.code),
    unique("referral_code_organizer_user_unique").on(table.userId, table.kind, table.eventId),
    index("referral_code_user_idx").on(table.userId),
  ],
);

export const referralConversion = pgTable(
  "referral_conversion",
  {
    id: text("id").primaryKey(),
    codeId: text("code_id")
      .notNull()
      .references(() => referralCode.id, { onDelete: "cascade" }),
    kind: referralKindEnum("kind").$type<ReferralKind>().notNull(),
    referrerUserId: text("referrer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refereeUserId: text("referee_user_id").references(() => user.id, { onDelete: "set null" }),
    refereeEmail: text("referee_email"),
    eventId: text("event_id").references(() => event.id, { onDelete: "set null" }),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    visitorHash: text("visitor_hash"),
    status: referralConversionStatusEnum("status").$type<ConversionStatus>().notNull(),
    rewardStatus: referralRewardStatusEnum("reward_status").$type<RewardStatus>().notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("referral_conversion_code_idx").on(table.codeId),
    index("referral_conversion_referrer_idx").on(table.referrerUserId),
    index("referral_conversion_referee_idx").on(table.refereeUserId),
  ],
);

export const embedImpressionDaily = pgTable(
  "embed_impression_daily",
  {
    id: text("id").primaryKey(),
    kind: embedKindEnum("kind").$type<EmbedKind>().notNull(),
    resourceId: text("resource_id").notNull(),
    day: text("day").notNull(),
    views: integer("views").notNull().default(0),
  },
  (table) => [unique("embed_impression_daily_unique").on(table.kind, table.resourceId, table.day)],
);
