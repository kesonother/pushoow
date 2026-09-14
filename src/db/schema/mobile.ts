import { boolean, index, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import type { MobilePlatform, MobilePushProvider } from "@/domain/mobile/types";

export const mobilePlatformEnum = pgEnum("mobile_platform", ["ios", "android"]);
export const mobilePushProviderEnum = pgEnum("mobile_push_provider", ["apns", "fcm"]);

export const mobileDevice = pgTable(
  "mobile_device",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: mobilePlatformEnum("platform").$type<MobilePlatform>().notNull(),
    pushProvider: mobilePushProviderEnum("push_provider").$type<MobilePushProvider>().notNull(),
    token: text("token").notNull(),
    appBundleId: text("app_bundle_id"),
    widgetInstalled: boolean("widget_installed").notNull().default(false),
    watchPaired: boolean("watch_paired").notNull().default(false),
    lastSnapshotAt: timestamp("last_snapshot_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("mobile_device_token_unique").on(table.token),
    index("mobile_device_user_idx").on(table.userId),
  ],
);
