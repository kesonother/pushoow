import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization } from "@/db/schema/organizations";
import { event } from "@/db/schema/events";

export const ticketVisibilityEnum = pgEnum("ticket_visibility", [
  "public",
  "unlisted",
  "members",
]);

export const couponKindEnum = pgEnum("coupon_kind", ["percentage", "fixed"]);

export const eventOrderStatusEnum = pgEnum("event_order_status", [
  "pending",
  "paid",
  "cancelled",
  "refund_pending",
  "refunded",
  "partially_refunded",
]);

export const eventRegistrationStatusEnum = pgEnum("event_registration_status", [
  "pending",
  "confirmed",
  "waitlisted",
  "offered",
  "cancelled",
  "checked_in",
  "expired",
]);

export const eventContentKindEnum = pgEnum("event_content_kind", [
  "speaker",
  "agenda",
  "faq",
]);

export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
  "daily",
  "weekly",
  "monthly",
]);

export const eventTicketType = pgTable(
  "event_ticket_type",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    capacity: integer("capacity"),
    salesStart: timestamp("sales_start", { withTimezone: true, mode: "date" }),
    salesEnd: timestamp("sales_end", { withTimezone: true, mode: "date" }),
    visibility: ticketVisibilityEnum("visibility").notNull().default("public"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("event_ticket_type_event_id_idx").on(table.eventId)],
);

export const eventCoupon = pgTable(
  "event_coupon",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id").references(() => event.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    kind: couponKindEnum("kind").notNull(),
    amount: integer("amount").notNull(),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [unique("event_coupon_code_unique").on(table.code)],
);

export const eventAddOn = pgTable(
  "event_add_on",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    capacity: integer("capacity"),
    inventory: integer("inventory"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("event_add_on_event_id_idx").on(table.eventId)],
);

export const eventOrder = pgTable(
  "event_order",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    buyerEmail: text("buyer_email").notNull(),
    buyerUserId: text("buyer_user_id"),
    status: eventOrderStatusEnum("status").notNull().default("pending"),
    subtotalCents: integer("subtotal_cents").notNull(),
    ticketSubtotalCents: integer("ticket_subtotal_cents").notNull().default(0),
    addOnSubtotalCents: integer("addon_subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    couponId: text("coupon_id"),
    paymentExternalId: text("payment_external_id"),
    idempotencyKey: text("idempotency_key"),
    connectedAccountId: text("connected_account_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("event_order_event_id_idx").on(table.eventId),
    unique("event_order_idempotency_key_unique").on(table.idempotencyKey),
  ],
);

export const eventOrderItem = pgTable("event_order_item", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  orderId: text("order_id")
    .notNull()
    .references(() => eventOrder.id, { onDelete: "cascade" }),
  ticketTypeId: text("ticket_type_id"),
  addOnId: text("add_on_id"),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
});

export const eventRegistration = pgTable(
  "event_registration",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    email: text("email").notNull(),
    status: eventRegistrationStatusEnum("status").notNull().default("confirmed"),
    occurrenceStartsAt: timestamp("occurrence_starts_at", { withTimezone: true, mode: "date" }),
    orderId: text("order_id"),
    ticketTypeId: text("ticket_type_id"),
    quantity: integer("quantity").notNull().default(1),
    offeredUntil: timestamp("offered_until", { withTimezone: true, mode: "date" }),
    waitlistPosition: integer("waitlist_position"),
    anonymous: boolean("anonymous").notNull().default(false),
    appearOnRoster: boolean("appear_on_roster").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("event_registration_email_unique").on(table.eventId, table.email),
    index("event_registration_event_id_idx").on(table.eventId),
    index("event_registration_org_created_idx").on(table.organizationId, table.createdAt),
  ],
);

export const eventContent = pgTable(
  "event_content",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    kind: eventContentKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("event_content_event_id_idx").on(table.eventId)],
);

export const eventRecurrenceRule = pgTable("event_recurrence_rule", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  frequency: recurrenceFrequencyEnum("frequency").notNull(),
  interval: integer("interval").notNull().default(1),
  weekdays: jsonb("weekdays").$type<number[]>().notNull().default(sql`'[]'::jsonb`),
  until: timestamp("until", { withTimezone: true, mode: "date" }),
  count: integer("count"),
  exceptions: jsonb("exceptions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const eventOccurrenceOverride = pgTable("event_occurrence_override", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  originalStartsAt: timestamp("original_starts_at", { withTimezone: true, mode: "date" }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
  cancelled: boolean("cancelled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});
