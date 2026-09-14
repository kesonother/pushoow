import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization } from "@/db/schema/organizations";
import { calendar } from "@/db/schema/calendars";

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "scheduled",
  "live",
  "ended",
  "cancelled",
  "postponed",
]);

export const eventVisibilityEnum = pgEnum("event_visibility", [
  "public",
  "unlisted",
  "private",
]);

export const eventLocationKindEnum = pgEnum("event_location_kind", [
  "physical",
  "virtual",
  "hybrid",
]);

export const eventRegistrationModeEnum = pgEnum("event_registration_mode", [
  "open_rsvp",
  "approval",
  "invitation",
  "password",
  "email_domain",
  "token",
]);

export const eventRosterModeEnum = pgEnum("event_roster_mode", [
  "visible",
  "hidden",
  "anonymized",
  "approval_only",
]);

export const event = pgTable(
  "event",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    timezone: text("timezone").notNull(),
    status: eventStatusEnum("status").notNull().default("draft"),
    visibility: eventVisibilityEnum("visibility").notNull().default("public"),
    isPaid: boolean("is_paid").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    city: text("city"),
    country: text("country"),
    category: text("category"),
    language: text("language"),
    searchText: text("search_text"),
    venueName: text("venue_name"),
    venueAddress: text("venue_address"),
    coverImageUrl: text("cover_image_url"),
    capacity: integer("capacity"),
    organizerUserId: text("organizer_user_id"),
    locationKind: eventLocationKindEnum("location_kind").notNull().default("physical"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    customPinLabel: text("custom_pin_label"),
    virtualUrl: text("virtual_url"),
    virtualProvider: text("virtual_provider"),
    templateId: text("template_id"),
    registrationMode: eventRegistrationModeEnum("registration_mode").notNull().default("open_rsvp"),
    rosterMode: eventRosterModeEnum("roster_mode").notNull().default("hidden"),
    registrationPasswordHash: text("registration_password_hash"),
    allowedEmailDomains: jsonb("allowed_email_domains").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    accessToken: text("access_token"),
    waitlistEnabled: boolean("waitlist_enabled").notNull().default(true),
    waitlistDuringPresale: boolean("waitlist_during_presale").notNull().default(false),
    seriesId: text("series_id"),
    recurrenceParentId: text("recurrence_parent_id"),
    isOccurrenceOverride: boolean("is_occurrence_override").notNull().default(false),
    postponedFromStartsAt: timestamp("postponed_from_starts_at", { withTimezone: true, mode: "date" }),
    postponedFromEndsAt: timestamp("postponed_from_ends_at", { withTimezone: true, mode: "date" }),
    dateHistory: jsonb("date_history").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("event_calendar_slug_unique").on(table.calendarId, table.slug),
    unique("event_slug_unique").on(table.slug),
    index("event_organization_id_idx").on(table.organizationId),
    index("event_calendar_starts_at_idx").on(table.calendarId, table.startsAt),
    index("event_status_idx").on(table.status),
    index("event_city_idx").on(table.city),
    index("event_country_idx").on(table.country),
    index("event_category_idx").on(table.category),
    index("event_language_idx").on(table.language),
    index("event_location_kind_idx").on(table.locationKind),
    index("event_visibility_starts_at_idx").on(table.visibility, table.startsAt),
    index("event_search_text_gin_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${table.searchText}, ''))`,
    ),
  ],
);
