import {
  ADD_ON_CATALOG,
  GRACE_PERIOD_DAYS,
  PRICING_GRID_DECISION,
  REFUND_WINDOW_DAYS,
  SAAS_CURRENCY,
  functionalLevelFromPlan,
  getPlan,
  listPublicPlans,
  monthlyPriceCents,
} from "@/domain/billing/catalog";
import { resolveEntitlements } from "@/domain/billing/entitlements";
import { quoteSubscription } from "@/domain/billing/quote";
import type {
  BillingCharger,
  BillingNotifier,
  BillingQuote,
  CancellationRepository,
  Invoice,
  InvoiceRepository,
  PaymentMethodRepository,
  PlanId,
  Subscription,
  SubscriptionItem,
  SubscriptionItemRepository,
  SubscriptionRepository,
  UsageMetric,
  UsageRepository,
} from "@/domain/billing/types";
import { PLAN_IDS } from "@/domain/billing/types";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import { billingOrganizationIdFor, type OrganizationRepository } from "@/domain/organization/types";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type { TaxPort } from "@/domain/payments/types";
import type { StripeConnectPort } from "@/domain/payments/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { randomToken } from "@/lib/token-crypto";
import { recordCheckoutFailed, recordCheckoutStarted, recordCheckoutSucceeded } from "@/observability/events";

const DAY_MS = 86_400_000;

export type BillingServiceDeps = {
  organizations: OrganizationRepository;
  subscriptions: SubscriptionRepository;
  items: SubscriptionItemRepository;
  invoices: InvoiceRepository;
  usage: UsageRepository;
  paymentMethods: PaymentMethodRepository;
  cancellations: CancellationRepository;
  tax?: TaxPort;
  stripe?: StripeConnectPort;
  charger?: BillingCharger;
  notify?: BillingNotifier;
  appUrl?: string;
  clock?: Clock;
  ids?: IdGenerator;
};

function addUtcMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function periodStartOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function periodEndOf(date: Date): Date {
  return addUtcMonths(periodStartOf(date), 1);
}

function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

function prorateCents(fromPrice: number, toPrice: number, start: Date, end: Date, now: Date): number {
  const periodMs = end.getTime() - start.getTime();
  const remainingMs = Math.max(0, end.getTime() - now.getTime());
  if (periodMs <= 0) return Math.max(0, toPrice);
  const unused = Math.floor((fromPrice * remainingMs) / periodMs);
  const next = Math.floor((toPrice * remainingMs) / periodMs);
  return Math.max(0, next - unused);
}

function addOnQuantitiesFromItems(items: SubscriptionItem[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const item of items) {
    if (item.kind === "addon" && item.addOnId) {
      quantities[item.addOnId] = (quantities[item.addOnId] ?? 0) + item.quantity;
    }
  }
  return quantities;
}

export function createBillingService(deps: BillingServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const charger: BillingCharger = deps.charger ?? {
    async charge(input) {
      if (input.amountCents <= 0) return { ok: true, processorFeeCents: 0 };
      return { ok: false, processorFeeCents: 0 };
    },
    async refund() {
      return { refundId: `re_${ids.id()}` };
    },
  };

  async function requireOrganization(organizationId: string) {
    const organization = await deps.organizations.findById(organizationId);
    if (!organization || organization.deletedAt) {
      throw new NotFoundError("Organization", organizationId);
    }
    return organization;
  }

  async function requireSubscription(actor: Actor): Promise<Subscription> {
    const subscription = await ensureFreeSubscription(actor.organizationId);
    assertSameTenant(subscription, actor.organizationId, "Subscription");
    return subscription;
  }

  async function syncFunctionalLevel(organizationId: string, planId: PlanId) {
    const organization = await requireOrganization(organizationId);
    const functionalLevel = functionalLevelFromPlan(planId);
    if (organization.functionalLevel === functionalLevel) return;
    await deps.organizations.update({
      ...organization,
      functionalLevel,
      updatedAt: clock.now(),
    });
  }

  async function replaceItems(subscription: Subscription, planId: PlanId, addOns: BillingQuote["addOns"]) {
    const now = clock.now();
    const plan = getPlan(planId);
    const listed = monthlyPriceCents(plan) ?? 0;
    const rows: SubscriptionItem[] = [
      {
        id: ids.id(),
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        kind: "plan",
        planId,
        addOnId: null,
        quantity: 1,
        unitPriceCents: listed,
        createdAt: now,
      },
      ...addOns.map((addOn) => ({
        id: ids.id(),
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        kind: "addon" as const,
        planId: null,
        addOnId: addOn.id,
        quantity: addOn.quantity,
        unitPriceCents: addOn.unitPriceCents,
        createdAt: now,
      })),
    ];
    return deps.items.replaceForSubscription(subscription.id, rows);
  }

  async function entitlementsFor(organizationId: string) {
    const subscription = await deps.subscriptions.findCurrentByOrganization(organizationId);
    const planId = subscription?.planId ?? "free";
    const items = subscription ? await deps.items.listBySubscription(subscription.id) : [];
    return resolveEntitlements(planId, addOnQuantitiesFromItems(items));
  }

  async function ensureFreeSubscription(organizationId: string): Promise<Subscription> {
    const existing = await deps.subscriptions.findCurrentByOrganization(organizationId);
    if (existing) return existing;
    const organization = await requireOrganization(organizationId);
    const now = clock.now();
    const subscription = await deps.subscriptions.create({
      id: ids.id(),
      organizationId: organization.id,
      billingOrganizationId: billingOrganizationIdFor(organization),
      planId: "free",
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: now,
      currentPeriodEnd: addUtcMonths(now, 1),
      cancelAtPeriodEnd: false,
      pendingPlanId: null,
      graceEndsAt: null,
      renewalNotice14SentAt: null,
      renewalNotice7SentAt: null,
      checkoutSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
    await replaceItems(subscription, "free", []);
    await syncFunctionalLevel(organization.id, "free");
    return subscription;
  }

  async function quoteChange(
    actor: Actor,
    input: {
      planId: string;
      addOns?: Array<{ id: string; quantity: number }>;
      address?: { country: string; postalCode?: string };
    },
  ): Promise<BillingQuote> {
    assertPermission(actor, "finance:read");
    if (!isPlanId(input.planId)) throw new ValidationError("Unknown plan");
    const subscription = await requireSubscription(actor);
    const organization = await requireOrganization(actor.organizationId);
    const from = getPlan(subscription.planId);
    const to = getPlan(input.planId);
    if (!to.purchasable && input.planId !== subscription.planId) {
      if (to.priceMonthlyCents === "custom") {
        throw new ValidationError("Enterprise pricing is custom and cannot be purchased self-serve", {
          planId: to.id,
          pricingGridDecision: PRICING_GRID_DECISION.status,
        });
      }
      throw new ValidationError(`${to.name} is no longer offered. The public plans are Free, Plus, and Enterprise.`, {
        planId: to.id,
        suggestedPlanId: to.aliasOf ?? "plus",
        pricingGridDecision: PRICING_GRID_DECISION.status,
      });
    }
    let change: BillingQuote["change"] = "none";
    if (to.rank > from.rank) change = "upgrade";
    else if (to.rank < from.rank) change = "downgrade";
    else if (input.planId !== subscription.planId) change = "upgrade";

    const fromPrice = monthlyPriceCents(from) ?? 0;
    const toPrice = monthlyPriceCents(to);
    const prorationCents =
      change === "upgrade" && toPrice != null
        ? prorateCents(
            fromPrice,
            toPrice,
            subscription.currentPeriodStart,
            subscription.currentPeriodEnd,
            clock.now(),
          )
        : toPrice ?? 0;

    let taxCents = 0;
    let taxConfigured = false;
    const merchandise =
      (change === "downgrade" ? 0 : prorationCents) +
      (input.addOns ?? []).reduce((sum, item) => {
        const addOn = ADD_ON_CATALOG[item.id];
        return sum + (addOn ? addOn.unitPriceMonthlyCents * item.quantity : 0);
      }, 0);
    if (deps.tax?.isConfigured() && merchandise > 0) {
      taxConfigured = true;
      const tax = await deps.tax.calculate({
        currency: SAAS_CURRENCY,
        amountCents: merchandise,
        address: input.address ?? null,
      });
      taxCents = tax.taxCents;
    }

    return quoteSubscription({
      organizationId: organization.id,
      billingOrganizationId: billingOrganizationIdFor(organization),
      fromPlanId: subscription.planId,
      toPlanId: input.planId,
      change,
      addOns: input.addOns,
      taxCents,
      taxConfigured,
      prorationCents: change === "downgrade" ? 0 : prorationCents,
    });
  }

  async function openInvoice(subscription: Subscription, quote: BillingQuote): Promise<Invoice> {
    const now = clock.now();
    return deps.invoices.create({
      id: ids.id(),
      organizationId: subscription.organizationId,
      billingOrganizationId: subscription.billingOrganizationId,
      subscriptionId: subscription.id,
      number: `INV-${now.getUTCFullYear()}-${ids.id().slice(-6).toUpperCase()}`,
      status: quote.totalCents === 0 ? "paid" : "open",
      currency: quote.currency,
      priceCents: quote.priceCents,
      addOnCents: quote.addOnCents,
      taxCents: quote.taxCents,
      platformFeeCents: quote.platformFeeCents,
      processorFeeCents: 0,
      totalCents: quote.totalCents,
      quote,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      paymentMethodId: null,
      paidAt: quote.totalCents === 0 ? now : null,
      refundedAt: null,
      refundedCents: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function applyPaidPlan(subscription: Subscription, quote: BillingQuote, invoice?: Invoice) {
    const now = clock.now();
    const next: Subscription = {
      ...subscription,
      planId: quote.toPlanId,
      status: "active",
      cancelAtPeriodEnd: false,
      pendingPlanId: null,
      graceEndsAt: null,
      renewalNotice14SentAt: null,
      renewalNotice7SentAt: null,
      updatedAt: now,
    };
    if (quote.change === "create" || quote.change === "renewal") {
      next.currentPeriodStart = now;
      next.currentPeriodEnd = addUtcMonths(now, 1);
    }
    await deps.subscriptions.save(next);
    await replaceItems(next, quote.toPlanId, quote.addOns);
    await syncFunctionalLevel(next.organizationId, quote.toPlanId);
    if (invoice && invoice.status !== "paid") {
      await deps.invoices.save({
        ...invoice,
        status: "paid",
        paidAt: now,
        updatedAt: now,
      });
    }
    recordCheckoutSucceeded();
    return next;
  }

  async function startCheckout(actor: Actor, quote: BillingQuote) {
    assertPermission(actor, "finance:write");
    const subscription = await requireSubscription(actor);
    if (quote.organizationId !== actor.organizationId) {
      throw new ForbiddenError("Cross-tenant access is not allowed");
    }
    if (quote.change === "none") {
      throw new ValidationError("No plan change to apply");
    }
    if (quote.change === "downgrade") {
      const now = clock.now();
      await deps.subscriptions.save({
        ...subscription,
        pendingPlanId: quote.toPlanId,
        updatedAt: now,
      });
      return { subscription: { ...subscription, pendingPlanId: quote.toPlanId }, invoice: null, checkoutUrl: null };
    }

    const invoice = await openInvoice(subscription, quote);
    if (quote.totalCents === 0) {
      const next = await applyPaidPlan(subscription, quote, invoice);
      return { subscription: next, invoice, checkoutUrl: null };
    }

    if (deps.stripe?.isConfigured()) {
      const appUrl = deps.appUrl ?? "http://localhost:3000";
      const checkout = await deps.stripe.createCheckout({
        orderId: invoice.id,
        amountCents: quote.totalCents,
        currency: quote.currency,
        successUrl: `${appUrl}/dashboard/organizations/${actor.organizationId}/billing?checkout=success`,
        cancelUrl: `${appUrl}/dashboard/organizations/${actor.organizationId}/billing?checkout=cancelled`,
        automaticTax: quote.taxConfigured,
        lineItems: quote.lines
          .filter((line) => line.amountCents > 0)
          .map((line) => ({ name: line.label, quantity: 1, unitAmountCents: line.amountCents })),
        metadata: {
          kind: "saas_subscription",
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          organizationId: subscription.organizationId,
        },
      });
      const now = clock.now();
      await deps.invoices.save({
        ...invoice,
        stripeCheckoutSessionId: checkout.externalId,
        stripePaymentIntentId: checkout.paymentIntentId ?? null,
        updatedAt: now,
      });
      await deps.subscriptions.save({
        ...subscription,
        checkoutSessionId: checkout.externalId,
        updatedAt: now,
      });
      recordCheckoutStarted();
      return {
        subscription,
        invoice: { ...invoice, stripeCheckoutSessionId: checkout.externalId },
        checkoutUrl: checkout.checkoutUrl,
      };
    }

    const charged = await charger.charge({
      invoiceId: invoice.id,
      organizationId: subscription.organizationId,
      amountCents: quote.totalCents,
      currency: quote.currency,
      paymentMethodId: (await deps.paymentMethods.findDefaultByBillingOrganization(subscription.billingOrganizationId))
        ?.id,
    });
    if (!charged.ok) {
      await recordPaymentFailed(invoice.id);
      throw new ConflictError("Payment failed");
    }
    const now = clock.now();
    const paid = await deps.invoices.save({
      ...invoice,
      status: "paid",
      processorFeeCents: charged.processorFeeCents,
      stripePaymentIntentId: charged.paymentIntentId ?? null,
      paymentMethodId: charged.paymentMethodId ?? invoice.paymentMethodId,
      paidAt: now,
      updatedAt: now,
    });
    const next = await applyPaidPlan(subscription, quote, paid);
    return { subscription: next, invoice: paid, checkoutUrl: null };
  }

  async function completeCheckout(sessionId: string, extras?: { paymentIntentId?: string | null }) {
    const invoice =
      (await deps.invoices.findByCheckoutSessionId(sessionId)) ??
      (await deps.subscriptions.findByCheckoutSessionId(sessionId).then(async (subscription) => {
        if (!subscription) return null;
        const invoices = await deps.invoices.listByOrganization(subscription.organizationId);
        return invoices.find((item) => item.status === "open") ?? null;
      }));
    if (!invoice) return null;
    const subscription = await deps.subscriptions.findById(invoice.subscriptionId);
    if (!subscription) return null;
    const now = clock.now();
    const paid = await deps.invoices.save({
      ...invoice,
      status: "paid",
      stripePaymentIntentId: extras?.paymentIntentId ?? invoice.stripePaymentIntentId,
      paidAt: now,
      updatedAt: now,
    });
    return applyPaidPlan(subscription, invoice.quote, paid);
  }

  async function recordPaymentFailed(invoiceId: string) {
    const invoice = await deps.invoices.findById(invoiceId);
    if (!invoice) throw new NotFoundError("Invoice", invoiceId);
    const subscription = await deps.subscriptions.findById(invoice.subscriptionId);
    if (!subscription) throw new NotFoundError("Subscription", invoice.subscriptionId);
    const now = clock.now();
    const graceEndsAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
    await deps.invoices.save({ ...invoice, updatedAt: now });
    const next = await deps.subscriptions.save({
      ...subscription,
      status: "past_due",
      graceEndsAt,
      updatedAt: now,
    });
    await deps.notify?.notify({
      organizationId: subscription.organizationId,
      templateKey: "billing_payment_failed",
      subject: "Payment failed",
      body: `We could not collect invoice ${invoice.number}. Access continues during a ${GRACE_PERIOD_DAYS}-day grace period.`,
      idempotencyKey: `billing:failed:${invoice.id}`,
    });
    recordCheckoutFailed();
    return next;
  }

  async function processRenewals(now = clock.now()) {
    const due = await deps.subscriptions.listDueForRenewal(now);
    const results: Subscription[] = [];
    for (const subscription of due) {
      if (subscription.cancelAtPeriodEnd) {
        const next = await deps.subscriptions.save({
          ...subscription,
          planId: "free",
          status: "active",
          cancelAtPeriodEnd: false,
          pendingPlanId: null,
          graceEndsAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: addUtcMonths(now, 1),
          updatedAt: now,
        });
        await replaceItems(next, "free", []);
        await syncFunctionalLevel(next.organizationId, "free");
        results.push(next);
        continue;
      }
      const targetPlanId = subscription.pendingPlanId ?? subscription.planId;
      const items = await deps.items.listBySubscription(subscription.id);
      const addOns = Object.entries(addOnQuantitiesFromItems(items)).map(([id, quantity]) => ({ id, quantity }));
      const quote = quoteSubscription({
        organizationId: subscription.organizationId,
        billingOrganizationId: subscription.billingOrganizationId,
        fromPlanId: subscription.planId,
        toPlanId: targetPlanId,
        change: "renewal",
        addOns,
      });
      const invoice = await openInvoice(subscription, quote);
      if (quote.totalCents === 0) {
        results.push(await applyPaidPlan(subscription, quote, invoice));
        continue;
      }
      const method = await deps.paymentMethods.findDefaultByBillingOrganization(subscription.billingOrganizationId);
      const charged = await charger.charge({
        invoiceId: invoice.id,
        organizationId: subscription.organizationId,
        amountCents: quote.totalCents,
        currency: quote.currency,
        paymentMethodId: method?.id,
      });
      if (!charged.ok) {
        await recordPaymentFailed(invoice.id);
        results.push((await deps.subscriptions.findById(subscription.id)) ?? subscription);
        continue;
      }
      const paid = await deps.invoices.save({
        ...invoice,
        status: "paid",
        processorFeeCents: charged.processorFeeCents,
        stripePaymentIntentId: charged.paymentIntentId ?? null,
        paymentMethodId: charged.paymentMethodId ?? method?.id ?? null,
        paidAt: now,
        updatedAt: now,
      });
      results.push(await applyPaidPlan(subscription, quote, paid));
    }
    return results;
  }

  async function processGraceExpiry(now = clock.now()) {
    const rows = await deps.subscriptions.listInGrace(now);
    const results: Subscription[] = [];
    for (const subscription of rows) {
      const invoices = await deps.invoices.listByOrganization(subscription.organizationId);
      for (const invoice of invoices.filter((item) => item.status === "open")) {
        await deps.invoices.save({ ...invoice, status: "uncollectible", updatedAt: now });
      }
      const next = await deps.subscriptions.save({
        ...subscription,
        planId: "free",
        status: "active",
        pendingPlanId: null,
        graceEndsAt: null,
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: addUtcMonths(now, 1),
        updatedAt: now,
      });
      await replaceItems(next, "free", []);
      await syncFunctionalLevel(next.organizationId, "free");
      results.push(next);
    }
    return results;
  }

  async function processRenewalNotices(now = clock.now()) {
    const rows = await deps.subscriptions.listForRenewalNotice(now);
    const sent: Array<{ subscriptionId: string; days: 14 | 7 }> = [];
    for (const subscription of rows) {
      const daysLeft = Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / DAY_MS);
      if (daysLeft <= 14 && !subscription.renewalNotice14SentAt) {
        await deps.notify?.notify({
          organizationId: subscription.organizationId,
          templateKey: "billing_renewal",
          subject: "Subscription renews in 14 days",
          body: `Your ${getPlan(subscription.planId).name} plan renews on ${subscription.currentPeriodEnd.toISOString()}.`,
          idempotencyKey: `billing:renewal-14:${subscription.id}:${subscription.currentPeriodEnd.toISOString()}`,
        });
        await deps.subscriptions.save({ ...subscription, renewalNotice14SentAt: now, updatedAt: now });
        sent.push({ subscriptionId: subscription.id, days: 14 });
      }
      const latest = (await deps.subscriptions.findById(subscription.id)) ?? subscription;
      if (daysLeft <= 7 && !latest.renewalNotice7SentAt) {
        await deps.notify?.notify({
          organizationId: latest.organizationId,
          templateKey: "billing_renewal",
          subject: "Subscription renews in 7 days",
          body: `Your ${getPlan(latest.planId).name} plan renews on ${latest.currentPeriodEnd.toISOString()}.`,
          idempotencyKey: `billing:renewal-7:${latest.id}:${latest.currentPeriodEnd.toISOString()}`,
        });
        await deps.subscriptions.save({ ...latest, renewalNotice7SentAt: now, updatedAt: now });
        sent.push({ subscriptionId: latest.id, days: 7 });
      }
    }
    return sent;
  }

  async function requestCancellation(actor: Actor) {
    assertPermission(actor, "finance:write");
    const subscription = await requireSubscription(actor);
    if (subscription.planId === "free") {
      throw new ValidationError("The free plan cannot be cancelled");
    }
    if (subscription.cancelAtPeriodEnd) {
      throw new ConflictError("Cancellation is already scheduled at period end");
    }
    const pending = await deps.cancellations.findPendingBySubscription(subscription.id);
    if (pending) return pending;
    return deps.cancellations.create({
      id: ids.id(),
      organizationId: subscription.organizationId,
      subscriptionId: subscription.id,
      status: "pending_confirmation",
      confirmationToken: randomToken(16),
      requestedAt: clock.now(),
      confirmedAt: null,
      emailSentAt: null,
    });
  }

  async function confirmCancellation(actor: Actor, token: string) {
    assertPermission(actor, "finance:write");
    const subscription = await requireSubscription(actor);
    const pending = await deps.cancellations.findPendingBySubscription(subscription.id);
    if (!pending || pending.confirmationToken !== token) {
      throw new ValidationError("Cancellation confirmation is invalid");
    }
    const now = clock.now();
    await deps.subscriptions.save({
      ...subscription,
      cancelAtPeriodEnd: true,
      updatedAt: now,
    });
    const confirmed = await deps.cancellations.save({
      ...pending,
      status: "confirmed",
      confirmedAt: now,
      emailSentAt: now,
    });
    await deps.notify?.notify({
      organizationId: subscription.organizationId,
      templateKey: "billing_cancellation",
      subject: "Subscription cancellation confirmed",
      body: `Your subscription will remain active until ${subscription.currentPeriodEnd.toISOString()}. No further charges will be made after that date.`,
      idempotencyKey: `billing:cancel:${confirmed.id}`,
    });
    return confirmed;
  }

  function refundableCents(invoice: Invoice) {
    return Math.max(0, invoice.totalCents - invoice.platformFeeCents - invoice.processorFeeCents);
  }

  async function requestRefund(actor: Actor, invoiceId: string) {
    assertPermission(actor, "finance:write");
    const invoice = await deps.invoices.findById(invoiceId);
    assertSameTenant(invoice, actor.organizationId, "Invoice");
    if (!invoice || invoice.status !== "paid") {
      throw new ConflictError("Only a paid invoice can be refunded");
    }
    if (invoice.quote.priceCents <= 0 && invoice.totalCents <= 0) {
      throw new ValidationError("Free invoices are not refundable");
    }
    if (!invoice.paidAt) throw new ConflictError("Invoice has no paid date");
    const elapsed = clock.now().getTime() - invoice.paidAt.getTime();
    if (elapsed > REFUND_WINDOW_DAYS * DAY_MS) {
      throw new ValidationError(`Refunds are available for ${REFUND_WINDOW_DAYS} days after payment`);
    }
    const amount = refundableCents(invoice);
    if (amount <= 0) throw new ValidationError("No refundable amount remains after transaction fees");
    if (invoice.stripePaymentIntentId) {
      await charger.refund({ paymentIntentId: invoice.stripePaymentIntentId, amountCents: amount });
    } else {
      await charger.refund({ amountCents: amount });
    }
    const now = clock.now();
    const refunded = await deps.invoices.save({
      ...invoice,
      status: "refunded",
      refundedAt: now,
      refundedCents: amount,
      updatedAt: now,
    });
    await deps.notify?.notify({
      organizationId: invoice.organizationId,
      templateKey: "billing_refund",
      subject: "Refund issued",
      body: `A refund of ${amount} cents was issued for invoice ${invoice.number}, excluding transaction fees.`,
      idempotencyKey: `billing:refund:${invoice.id}`,
    });
    return refunded;
  }

  async function recordUsage(organizationId: string, metric: UsageMetric, quantity = 1) {
    const now = clock.now();
    return deps.usage.increment({
      id: ids.id(),
      organizationId,
      metric,
      periodStart: periodStartOf(now),
      periodEnd: periodEndOf(now),
      quantity,
    });
  }

  async function usageFor(organizationId: string, metric: UsageMetric) {
    const now = clock.now();
    return (await deps.usage.find(organizationId, metric, periodStartOf(now)))?.quantity ?? 0;
  }

  async function handleStripeEvent(input: { type: string; object: Record<string, unknown> }) {
    const metadata = (input.object.metadata ?? {}) as Record<string, unknown>;
    if (metadata.kind !== "saas_subscription") return null;
    const sessionId = typeof input.object.id === "string" ? input.object.id : null;
    const paymentIntent =
      typeof input.object.payment_intent === "string"
        ? input.object.payment_intent
        : ((input.object.payment_intent as { id?: string } | undefined)?.id ?? null);
    if (input.type === "checkout.session.completed" && sessionId) {
      return completeCheckout(sessionId, { paymentIntentId: paymentIntent });
    }
    if (
      (input.type === "checkout.session.expired" || input.type === "payment_intent.payment_failed") &&
      sessionId
    ) {
      const invoice = await deps.invoices.findByCheckoutSessionId(sessionId);
      if (invoice) await recordPaymentFailed(invoice.id);
    }
    return null;
  }

  async function overview(actor: Actor) {
    assertPermission(actor, "finance:read");
    const subscription = await requireSubscription(actor);
    const items = await deps.items.listBySubscription(subscription.id);
    const invoices = await deps.invoices.listByOrganization(actor.organizationId);
    const cancellation = await deps.cancellations.findPendingBySubscription(subscription.id);
    return {
      pricingGridDecision: PRICING_GRID_DECISION,
      catalog: listPublicPlans().map((plan) => ({
        id: plan.id,
        name: plan.name,
        grids: plan.grids,
        priceMonthlyCents: plan.priceMonthlyCents,
        priceSource: plan.priceSource,
        purchasable: plan.purchasable,
        entitlements: plan.entitlements,
      })),
      subscription,
      items,
      entitlements: await entitlementsFor(actor.organizationId),
      invoices,
      cancellation: cancellation
        ? {
            id: cancellation.id,
            status: cancellation.status,
            confirmationToken: cancellation.confirmationToken,
          }
        : null,
    };
  }

  return {
    entitlementsFor,
    ensureFreeSubscription,
    overview,
    quoteChange,
    startCheckout,
    completeCheckout,
    recordPaymentFailed,
    processRenewals,
    processGraceExpiry,
    processRenewalNotices,
    requestCancellation,
    confirmCancellation,
    requestRefund,
    recordUsage,
    usageFor,
    handleStripeEvent,
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
