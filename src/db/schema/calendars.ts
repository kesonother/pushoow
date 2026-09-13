import {
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization } from "@/db/schema/organizations";

export const calendarVisibilityEnum = pgEnum("calendar_visibility", [
  "public",
  "unlisted",
  "private",
]);

export const calendar = pgTable(
  "calendar",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    timezone: text("timezone").notNull().default("UTC"),
    locale: text("locale").notNull().default("en"),
    defaultCurrency: text("default_currency").notNull().default("EUR"),
    visibility: calendarVisibilityEnum("visibility").notNull().default("public"),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    bannedWords: jsonb("banned_words").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color"),
    bannerUrl: text("banner_url"),
    socialLink: text("social_link"),
    contactEmail: text("contact_email"),
    postalAddress: text("postal_address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    feedToken: text("feed_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("calendar_slug_unique").on(table.slug),
    index("calendar_organization_id_idx").on(table.organizationId),
    index("calendar_visibility_idx").on(table.visibility),
  ],
);

export const calendarSlugChange = pgTable(
  "calendar_slug_change",
  {
    id: text("id").primaryKey(),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    fromSlug: text("from_slug").notNull(),
    toSlug: text("to_slug").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("calendar_slug_change_calendar_id_idx").on(table.calendarId),
    index("calendar_slug_change_changed_at_idx").on(table.calendarId, table.changedAt),
  ],
);
