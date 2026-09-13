import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import { organization } from "@/db/schema/organizations";
import { calendar } from "@/db/schema/calendars";
import { event } from "@/db/schema/events";

export const subscriberStatusEnum = pgEnum("subscriber_status", [
  "active",
  "unsubscribed",
]);

export const registrantStatusEnum = pgEnum("registrant_status", [
  "registered",
  "waitlisted",
  "cancelled",
  "checked_in",
]);

export const calendarSubscriber = pgTable(
  "calendar_subscriber",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    status: subscriberStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("calendar_subscriber_email_unique").on(table.calendarId, table.email),
    index("calendar_subscriber_organization_id_idx").on(table.organizationId),
  ],
);

export const calendarFollower = pgTable(
  "calendar_follower",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notifyEmail: boolean("notify_email").notNull().default(true),
    notifyPush: boolean("notify_push").notNull().default(false),
    notifySms: boolean("notify_sms").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("calendar_follower_user_unique").on(table.calendarId, table.userId),
    index("calendar_follower_organization_id_idx").on(table.organizationId),
    index("calendar_follower_calendar_id_idx").on(table.calendarId),
  ],
);

export const calendarTierKindEnum = pgEnum("calendar_tier_kind", [
  "free",
  "one_time",
  "subscription",
  "tier_gated",
]);

export const calendarTierVisibilityEnum = pgEnum("calendar_tier_visibility", [
  "public",
  "members",
]);

export const calendarMembershipStatusEnum = pgEnum("calendar_membership_status", [
  "pending",
  "approved",
  "rejected",
  "awaiting_payment",
  "active",
  "cancelled",
]);

export const calendarMembershipTier = pgTable(
  "calendar_membership_tier",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: calendarTierKindEnum("kind").notNull(),
    visibility: calendarTierVisibilityEnum("visibility").notNull().default("public"),
    memberOnlyTickets: boolean("member_only_tickets").notNull().default(false),
    newsletters: boolean("newsletters").notNull().default(false),
    earlyRsvp: boolean("early_rsvp").notNull().default(false),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    priceCents: integer("price_cents"),
    currency: text("currency"),
    interval: text("interval"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("calendar_membership_tier_calendar_id_idx").on(table.calendarId),
    index("calendar_membership_tier_organization_id_idx").on(table.organizationId),
  ],
);

export const calendarMember = pgTable(
  "calendar_member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tierId: text("tier_id")
      .notNull()
      .references(() => calendarMembershipTier.id, { onDelete: "restrict" }),
    status: calendarMembershipStatusEnum("status").notNull().default("pending"),
    paymentExternalId: text("payment_external_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("calendar_member_user_unique").on(table.calendarId, table.userId),
    index("calendar_member_organization_id_idx").on(table.organizationId),
    index("calendar_member_calendar_id_idx").on(table.calendarId),
  ],
);

export const eventRegistrant = pgTable(
  "event_registrant",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    status: registrantStatusEnum("status").notNull().default("registered"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("event_registrant_email_unique").on(table.eventId, table.email),
    index("event_registrant_organization_id_idx").on(table.organizationId),
    index("event_registrant_event_id_idx").on(table.eventId),
  ],
);
