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

export function createMemorySubscriptions(): SubscriptionRepository {
  const items = new Map<string, Subscription>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findCurrentByOrganization(organizationId) {
      const rows = [...items.values()]
        .filter((item) => item.organizationId === organizationId && item.status !== "expired")
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return (
        rows.find((item) => item.status === "active" || item.status === "past_due" || item.status === "grace") ??
        rows[0] ??
        null
      );
    },
    async findByCheckoutSessionId(sessionId) {
      return [...items.values()].find((item) => item.checkoutSessionId === sessionId) ?? null;
    },
    async listDueForRenewal(now) {
      return [...items.values()].filter(
        (item) =>
          item.currentPeriodEnd <= now &&
          (item.status === "active" || item.status === "trialing" || item.status === "past_due"),
      );
    },
    async listForRenewalNotice(now) {
      const horizon = new Date(now.getTime() + 14 * DAY_MS);
      return [...items.values()].filter(
        (item) =>
          item.status === "active" &&
          !item.cancelAtPeriodEnd &&
          item.planId !== "free" &&
          item.currentPeriodEnd > now &&
          item.currentPeriodEnd <= horizon,
      );
    },
    async listInGrace(now) {
      return [...items.values()].filter(
        (item) =>
          (item.status === "grace" || item.status === "past_due") &&
          item.graceEndsAt != null &&
          item.graceEndsAt <= now,
      );
    },
  };
}

export function createMemorySubscriptionItems(): SubscriptionItemRepository {
  const items = new Map<string, SubscriptionItem>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async listBySubscription(subscriptionId) {
      return [...items.values()].filter((item) => item.subscriptionId === subscriptionId);
    },
    async replaceForSubscription(subscriptionId, next) {
      for (const [id, item] of items) {
        if (item.subscriptionId === subscriptionId) items.delete(id);
      }
      for (const item of next) items.set(item.id, item);
      return next;
    },
  };
}

export function createMemoryInvoices(): InvoiceRepository {
  const items = new Map<string, Invoice>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByCheckoutSessionId(sessionId) {
      return [...items.values()].find((item) => item.stripeCheckoutSessionId === sessionId) ?? null;
    },
    async findByPaymentIntentId(paymentIntentId) {
      return [...items.values()].find((item) => item.stripePaymentIntentId === paymentIntentId) ?? null;
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
    async listByBillingOrganization(billingOrganizationId) {
      return [...items.values()].filter((item) => item.billingOrganizationId === billingOrganizationId);
    },
  };
}

export function createMemoryUsage(): UsageRepository {
  const items = new Map<string, Usage>();
  function keyOf(organizationId: string, metric: string, periodStart: Date) {
    return `${organizationId}:${metric}:${periodStart.toISOString()}`;
  }
  return {
    async increment(input) {
      const key = keyOf(input.organizationId, input.metric, input.periodStart);
      const existing = items.get(key);
      const next: Usage = existing
        ? { ...existing, quantity: existing.quantity + input.quantity }
        : {
            id: input.id,
            organizationId: input.organizationId,
            metric: input.metric,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            quantity: input.quantity,
          };
      items.set(key, next);
      return next;
    },
    async find(organizationId, metric, periodStart) {
      return items.get(keyOf(organizationId, metric, periodStart)) ?? null;
    },
    async listByOrganization(organizationId, periodStart) {
      return [...items.values()].filter(
        (item) => item.organizationId === organizationId && item.periodStart.getTime() === periodStart.getTime(),
      );
    },
  };
}

export function createMemoryPaymentMethods(): PaymentMethodRepository {
  const items = new Map<string, PaymentMethodRef>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findDefaultByBillingOrganization(billingOrganizationId) {
      return [...items.values()].find((item) => item.billingOrganizationId === billingOrganizationId) ?? null;
    },
  };
}

export function createMemoryCancellations(): CancellationRepository {
  const items = new Map<string, Cancellation>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findPendingBySubscription(subscriptionId) {
      return (
        [...items.values()].find(
          (item) => item.subscriptionId === subscriptionId && item.status === "pending_confirmation",
        ) ?? null
      );
    },
  };
}
