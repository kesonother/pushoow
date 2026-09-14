import { date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import { event } from "@/db/schema/events";
import { eventRegistration } from "@/db/schema/event-commerce";
import type { AnalyticsPlan, RegistrationSource } from "@/domain/analytics/types";

export const analyticsPlanEnum = pgEnum("analytics_plan", ["free", "pro", "plus"]);
export const analyticsScopeEnum = pgEnum("analytics_scope", ["organization", "event"]);
export const registrationSourceEnum = pgEnum("registration_source", [
  "direct",
  "checkout",
  "walk_in",
  "import",
  "search",
]);

export const analyticsPlan = pgTable("analytics_plan", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  plan: analyticsPlanEnum("plan").$type<AnalyticsPlan>().notNull().default("free"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const registrationAttribution = pgTable(
  "registration_attribution",
  {
    registrationId: text("registration_id")
      .primaryKey()
      .references(() => eventRegistration.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    source: registrationSourceEnum("source").$type<RegistrationSource>().notNull().default("direct"),
    tags: text("tags").array().notNull().default([]),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
  },
  (table) => [
    index("registration_attribution_event_idx").on(table.eventId),
    index("registration_attribution_org_idx").on(table.organizationId),
  ],
);

export const eventPageViewDaily = pgTable(
  "event_page_view_daily",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    views: integer("views").notNull().default(0),
    uniqueVisitors: integer("unique_visitors").notNull().default(0),
  },
  (table) => [
    unique("event_page_view_daily_unique").on(table.eventId, table.day),
    index("event_page_view_daily_org_day_idx").on(table.organizationId, table.day),
  ],
);

export const eventPageViewVisitor = pgTable(
  "event_page_view_visitor",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    visitorHash: text("visitor_hash").notNull(),
  },
  (table) => [unique("event_page_view_visitor_unique").on(table.eventId, table.day, table.visitorHash)],
);

export const analyticsSnapshot = pgTable(
  "analytics_snapshot",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    scope: analyticsScopeEnum("scope").notNull(),
    scopeId: text("scope_id").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [unique("analytics_snapshot_scope_unique").on(table.scope, table.scopeId)],
);
