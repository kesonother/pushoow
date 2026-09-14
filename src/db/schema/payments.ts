import { boolean, index, integer, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import { event } from "@/db/schema/events";
import { eventOrder, eventRegistration, eventTicketType } from "@/db/schema/event-commerce";

export const kycStatusEnum = pgEnum("kyc_status", ["pending", "restricted", "verified"]);
export const payoutStatusEnum = pgEnum("payout_status", ["pending", "active", "disabled"]);
export const checkoutPaymentStatusEnum = pgEnum("checkout_payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);
export const issuedTicketStatusEnum = pgEnum("issued_ticket_status", ["valid", "refunded", "void"]);
export const paymentRefundKindEnum = pgEnum("payment_refund_kind", ["individual", "partial", "full"]);

export const stripeConnectedAccount = pgTable(
  "stripe_connected_account",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeAccountId: text("stripe_account_id").notNull(),
    chargesEnabled: boolean("charges_enabled").notNull().default(false),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    kycStatus: kycStatusEnum("kyc_status").notNull().default("pending"),
    payoutStatus: payoutStatusEnum("payout_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("stripe_connected_account_org_unique").on(table.organizationId),
    unique("stripe_connected_account_stripe_unique").on(table.stripeAccountId),
  ],
);

export const checkoutPayment = pgTable(
  "checkout_payment",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => eventOrder.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    status: checkoutPaymentStatusEnum("status").notNull().default("pending"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    checkoutUrl: text("checkout_url"),
    applicationFeeCents: integer("application_fee_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("checkout_payment_order_unique").on(table.orderId),
    index("checkout_payment_org_idx").on(table.organizationId),
    index("checkout_payment_session_idx").on(table.stripeCheckoutSessionId),
  ],
);

export const paymentRefund = pgTable(
  "payment_refund",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    paymentId: text("payment_id")
      .notNull()
      .references(() => checkoutPayment.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => eventOrder.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull(),
    kind: paymentRefundKindEnum("kind").notNull(),
    stripeRefundId: text("stripe_refund_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("payment_refund_org_idx").on(table.organizationId)],
);

export const issuedTicket = pgTable(
  "issued_ticket",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => eventOrder.id, { onDelete: "cascade" }),
    registrationId: text("registration_id").references(() => eventRegistration.id, { onDelete: "set null" }),
    ticketTypeId: text("ticket_type_id").references(() => eventTicketType.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    status: issuedTicketStatusEnum("status").notNull().default("valid"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("issued_ticket_code_unique").on(table.code),
    index("issued_ticket_order_idx").on(table.orderId),
  ],
);

export const stripeWebhookEvent = pgTable(
  "stripe_webhook_event",
  {
    id: text("id").primaryKey(),
    stripeEventId: text("stripe_event_id").notNull(),
    type: text("type").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [unique("stripe_webhook_event_stripe_id_unique").on(table.stripeEventId)],
);

export const taxRecord = pgTable(
  "tax_record",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => eventOrder.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    taxCents: integer("tax_cents").notNull(),
    exemptionCode: text("exemption_code"),
    stripeCalculationId: text("stripe_calculation_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("tax_record_org_idx").on(table.organizationId)],
);
