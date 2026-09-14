import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import type { BillingCycle, BillingQuote, InvoiceStatus, PlanId, SubscriptionStatus, UsageMetric } from "@/domain/billing/types";

export const billingSubscriptionStatusEnum = pgEnum("billing_subscription_status", [
  "trialing",
  "active",
  "past_due",
  "grace",
  "canceled",
  "expired",
]);

export const billingInvoiceStatusEnum = pgEnum("billing_invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
  "refunded",
]);

export const billingItemKindEnum = pgEnum("billing_item_kind", ["plan", "addon"]);
export const billingCancellationStatusEnum = pgEnum("billing_cancellation_status", [
  "pending_confirmation",
  "confirmed",
]);

export const billingSubscription = pgTable(
  "billing_subscription",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    billingOrganizationId: text("billing_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    planId: text("plan_id").$type<PlanId>().notNull(),
    status: billingSubscriptionStatusEnum("status").$type<SubscriptionStatus>().notNull(),
    billingCycle: text("billing_cycle").$type<BillingCycle>().notNull().default("monthly"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: "date" }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "date" }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    pendingPlanId: text("pending_plan_id").$type<PlanId>(),
    graceEndsAt: timestamp("grace_ends_at", { withTimezone: true, mode: "date" }),
    renewalNotice14SentAt: timestamp("renewal_notice_14_sent_at", { withTimezone: true, mode: "date" }),
    renewalNotice7SentAt: timestamp("renewal_notice_7_sent_at", { withTimezone: true, mode: "date" }),
    checkoutSessionId: text("checkout_session_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("billing_subscription_org_idx").on(table.organizationId),
    index("billing_subscription_billing_org_idx").on(table.billingOrganizationId),
    index("billing_subscription_period_end_idx").on(table.status, table.currentPeriodEnd),
    index("billing_subscription_checkout_idx").on(table.checkoutSessionId),
  ],
);

export const billingSubscriptionItem = pgTable(
  "billing_subscription_item",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => billingSubscription.id, { onDelete: "cascade" }),
    kind: billingItemKindEnum("kind").notNull(),
    planId: text("plan_id").$type<PlanId>(),
    addOnId: text("add_on_id"),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("billing_subscription_item_sub_idx").on(table.subscriptionId)],
);

export const billingInvoice = pgTable(
  "billing_invoice",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    billingOrganizationId: text("billing_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => billingSubscription.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    status: billingInvoiceStatusEnum("status").$type<InvoiceStatus>().notNull(),
    currency: text("currency").notNull(),
    priceCents: integer("price_cents").notNull(),
    addOnCents: integer("add_on_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    processorFeeCents: integer("processor_fee_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    quote: jsonb("quote").$type<BillingQuote>().notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paymentMethodId: text("payment_method_id"),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    refundedAt: timestamp("refunded_at", { withTimezone: true, mode: "date" }),
    refundedCents: integer("refunded_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("billing_invoice_number_unique").on(table.number),
    index("billing_invoice_org_idx").on(table.organizationId),
    index("billing_invoice_session_idx").on(table.stripeCheckoutSessionId),
  ],
);

export const billingUsage = pgTable(
  "billing_usage",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    metric: text("metric").$type<UsageMetric>().notNull(),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }).notNull(),
    quantity: integer("quantity").notNull().default(0),
  },
  (table) => [
    unique("billing_usage_org_metric_period_unique").on(table.organizationId, table.metric, table.periodStart),
    index("billing_usage_org_idx").on(table.organizationId),
  ],
);

export const billingPaymentMethod = pgTable(
  "billing_payment_method",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    billingOrganizationId: text("billing_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    brand: text("brand"),
    last4: text("last4"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("billing_payment_method_billing_org_idx").on(table.billingOrganizationId)],
);

export const billingCancellation = pgTable(
  "billing_cancellation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => billingSubscription.id, { onDelete: "cascade" }),
    status: billingCancellationStatusEnum("status").notNull(),
    confirmationToken: text("confirmation_token").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("billing_cancellation_sub_idx").on(table.subscriptionId)],
);
