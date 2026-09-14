import { and, desc, eq, lte, ne, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  billingCancellation,
  billingInvoice,
  billingPaymentMethod,
  billingSubscription,
  billingSubscriptionItem,
  billingUsage,
} from "@/db/schema/billing";
import type {
  Cancellation,
  CancellationRepository,
  Invoice,
  InvoiceRepository,
  PaymentMethodRef,
  PaymentMethodRepository,
  Subscription,
  SubscriptionItem,
  SubscriptionItemRepository,
  SubscriptionRepository,
  Usage,
  UsageRepository,
} from "@/domain/billing/types";

const DAY_MS = 86_400_000;

function mapSubscription(row: typeof billingSubscription.$inferSelect): Subscription {
  return {
    id: row.id,
    organizationId: row.organizationId,
    billingOrganizationId: row.billingOrganizationId,
    planId: row.planId,
    status: row.status,
    billingCycle: row.billingCycle,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    pendingPlanId: row.pendingPlanId ?? null,
    graceEndsAt: row.graceEndsAt ?? null,
    renewalNotice14SentAt: row.renewalNotice14SentAt ?? null,
    renewalNotice7SentAt: row.renewalNotice7SentAt ?? null,
    checkoutSessionId: row.checkoutSessionId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapItem(row: typeof billingSubscriptionItem.$inferSelect): SubscriptionItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    subscriptionId: row.subscriptionId,
    kind: row.kind,
    planId: row.planId ?? null,
    addOnId: row.addOnId ?? null,
    quantity: row.quantity,
    unitPriceCents: row.unitPriceCents,
    createdAt: row.createdAt,
  };
}

function mapInvoice(row: typeof billingInvoice.$inferSelect): Invoice {
  return {
    id: row.id,
    organizationId: row.organizationId,
    billingOrganizationId: row.billingOrganizationId,
    subscriptionId: row.subscriptionId,
    number: row.number,
    status: row.status,
    currency: row.currency as Invoice["currency"],
    priceCents: row.priceCents,
    addOnCents: row.addOnCents,
    taxCents: row.taxCents,
    platformFeeCents: row.platformFeeCents,
    processorFeeCents: row.processorFeeCents,
    totalCents: row.totalCents,
    quote: row.quote,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId ?? null,
    stripePaymentIntentId: row.stripePaymentIntentId ?? null,
    paymentMethodId: row.paymentMethodId ?? null,
    paidAt: row.paidAt ?? null,
    refundedAt: row.refundedAt ?? null,
    refundedCents: row.refundedCents,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapUsage(row: typeof billingUsage.$inferSelect): Usage {
  return {
    id: row.id,
    organizationId: row.organizationId,
    metric: row.metric,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    quantity: row.quantity,
  };
}

function mapPaymentMethod(row: typeof billingPaymentMethod.$inferSelect): PaymentMethodRef {
  return {
    id: row.id,
    organizationId: row.organizationId,
    billingOrganizationId: row.billingOrganizationId,
    provider: "stripe",
    externalId: row.externalId,
    brand: row.brand ?? null,
    last4: row.last4 ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCancellation(row: typeof billingCancellation.$inferSelect): Cancellation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    subscriptionId: row.subscriptionId,
    status: row.status,
    confirmationToken: row.confirmationToken,
    requestedAt: row.requestedAt,
    confirmedAt: row.confirmedAt ?? null,
    emailSentAt: row.emailSentAt ?? null,
  };
}

export function createDrizzleSubscriptionRepository(db: Database): SubscriptionRepository {
  return {
    async create(item) {
      const [row] = await db.insert(billingSubscription).values(item).returning();
      return mapSubscription(row!);
    },
    async save(item) {
      const [row] = await db
        .update(billingSubscription)
        .set(item)
        .where(eq(billingSubscription.id, item.id))
        .returning();
      return mapSubscription(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(billingSubscription).where(eq(billingSubscription.id, id)).limit(1);
      return row ? mapSubscription(row) : null;
    },
    async findCurrentByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(billingSubscription)
        .where(and(eq(billingSubscription.organizationId, organizationId), ne(billingSubscription.status, "expired")))
        .orderBy(desc(billingSubscription.updatedAt));
      const mapped = rows.map(mapSubscription);
      return (
        mapped.find((item) => item.status === "active" || item.status === "past_due" || item.status === "grace") ??
        mapped[0] ??
        null
      );
    },
    async findByCheckoutSessionId(sessionId) {
      const [row] = await db
        .select()
        .from(billingSubscription)
        .where(eq(billingSubscription.checkoutSessionId, sessionId))
        .limit(1);
      return row ? mapSubscription(row) : null;
    },
    async listDueForRenewal(now) {
      const rows = await db
        .select()
        .from(billingSubscription)
        .where(lte(billingSubscription.currentPeriodEnd, now));
      return rows
        .map(mapSubscription)
        .filter((item) => item.status === "active" || item.status === "trialing" || item.status === "past_due");
    },
    async listForRenewalNotice(now) {
      const horizon = new Date(now.getTime() + 14 * DAY_MS);
      const rows = await db
        .select()
        .from(billingSubscription)
        .where(
          and(
            eq(billingSubscription.status, "active"),
            eq(billingSubscription.cancelAtPeriodEnd, false),
            lte(billingSubscription.currentPeriodEnd, horizon),
          ),
        );
      return rows
        .map(mapSubscription)
        .filter((item) => item.planId !== "free" && item.currentPeriodEnd > now);
    },
    async listInGrace(now) {
      const rows = await db
        .select()
        .from(billingSubscription)
        .where(lte(billingSubscription.graceEndsAt, now));
      return rows
        .map(mapSubscription)
        .filter((item) => item.status === "grace" || item.status === "past_due");
    },
  };
}

export function createDrizzleSubscriptionItemRepository(db: Database): SubscriptionItemRepository {
  return {
    async create(item) {
      const [row] = await db.insert(billingSubscriptionItem).values(item).returning();
      return mapItem(row!);
    },
    async listBySubscription(subscriptionId) {
      const rows = await db
        .select()
        .from(billingSubscriptionItem)
        .where(eq(billingSubscriptionItem.subscriptionId, subscriptionId));
      return rows.map(mapItem);
    },
    async replaceForSubscription(subscriptionId, items) {
      await db.delete(billingSubscriptionItem).where(eq(billingSubscriptionItem.subscriptionId, subscriptionId));
      if (items.length === 0) return [];
      const rows = await db.insert(billingSubscriptionItem).values(items).returning();
      return rows.map(mapItem);
    },
  };
}

export function createDrizzleInvoiceRepository(db: Database): InvoiceRepository {
  return {
    async create(item) {
      const [row] = await db.insert(billingInvoice).values(item).returning();
      return mapInvoice(row!);
    },
    async save(item) {
      const [row] = await db.update(billingInvoice).set(item).where(eq(billingInvoice.id, item.id)).returning();
      return mapInvoice(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(billingInvoice).where(eq(billingInvoice.id, id)).limit(1);
      return row ? mapInvoice(row) : null;
    },
    async findByCheckoutSessionId(sessionId) {
      const [row] = await db
        .select()
        .from(billingInvoice)
        .where(eq(billingInvoice.stripeCheckoutSessionId, sessionId))
        .limit(1);
      return row ? mapInvoice(row) : null;
    },
    async findByPaymentIntentId(paymentIntentId) {
      const [row] = await db
        .select()
        .from(billingInvoice)
        .where(eq(billingInvoice.stripePaymentIntentId, paymentIntentId))
        .limit(1);
      return row ? mapInvoice(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(billingInvoice)
        .where(eq(billingInvoice.organizationId, organizationId))
        .orderBy(desc(billingInvoice.createdAt));
      return rows.map(mapInvoice);
    },
    async listByBillingOrganization(billingOrganizationId) {
      const rows = await db
        .select()
        .from(billingInvoice)
        .where(eq(billingInvoice.billingOrganizationId, billingOrganizationId))
        .orderBy(desc(billingInvoice.createdAt));
      return rows.map(mapInvoice);
    },
  };
}

export function createDrizzleUsageRepository(db: Database): UsageRepository {
  return {
    async increment(input) {
      const [row] = await db
        .insert(billingUsage)
        .values(input)
        .onConflictDoUpdate({
          target: [billingUsage.organizationId, billingUsage.metric, billingUsage.periodStart],
          set: { quantity: sql`${billingUsage.quantity} + ${input.quantity}` },
        })
        .returning();
      return mapUsage(row!);
    },
    async find(organizationId, metric, periodStart) {
      const [row] = await db
        .select()
        .from(billingUsage)
        .where(
          and(
            eq(billingUsage.organizationId, organizationId),
            eq(billingUsage.metric, metric),
            eq(billingUsage.periodStart, periodStart),
          ),
        )
        .limit(1);
      return row ? mapUsage(row) : null;
    },
    async listByOrganization(organizationId, periodStart) {
      const rows = await db
        .select()
        .from(billingUsage)
        .where(and(eq(billingUsage.organizationId, organizationId), eq(billingUsage.periodStart, periodStart)));
      return rows.map(mapUsage);
    },
  };
}

export function createDrizzlePaymentMethodRepository(db: Database): PaymentMethodRepository {
  return {
    async create(item) {
      const [row] = await db.insert(billingPaymentMethod).values(item).returning();
      return mapPaymentMethod(row!);
    },
    async save(item) {
      const [row] = await db
        .update(billingPaymentMethod)
        .set(item)
        .where(eq(billingPaymentMethod.id, item.id))
        .returning();
      return mapPaymentMethod(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(billingPaymentMethod).where(eq(billingPaymentMethod.id, id)).limit(1);
      return row ? mapPaymentMethod(row) : null;
    },
    async findDefaultByBillingOrganization(billingOrganizationId) {
      const [row] = await db
        .select()
        .from(billingPaymentMethod)
        .where(eq(billingPaymentMethod.billingOrganizationId, billingOrganizationId))
        .orderBy(desc(billingPaymentMethod.createdAt))
        .limit(1);
      return row ? mapPaymentMethod(row) : null;
    },
  };
}

export function createDrizzleCancellationRepository(db: Database): CancellationRepository {
  return {
    async create(item) {
      const [row] = await db.insert(billingCancellation).values(item).returning();
      return mapCancellation(row!);
    },
    async save(item) {
      const [row] = await db
        .update(billingCancellation)
        .set(item)
        .where(eq(billingCancellation.id, item.id))
        .returning();
      return mapCancellation(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(billingCancellation).where(eq(billingCancellation.id, id)).limit(1);
      return row ? mapCancellation(row) : null;
    },
    async findPendingBySubscription(subscriptionId) {
      const [row] = await db
        .select()
        .from(billingCancellation)
        .where(
          and(
            eq(billingCancellation.subscriptionId, subscriptionId),
            eq(billingCancellation.status, "pending_confirmation"),
          ),
        )
        .limit(1);
      return row ? mapCancellation(row) : null;
    },
  };
}
