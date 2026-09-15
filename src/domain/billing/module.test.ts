import { describe, expect, it } from "vitest";
import { PRICING_GRID_DECISION, entitlementsFor, getPlan } from "@/domain/billing/catalog";
import { createBillingService } from "@/domain/billing/service";
import {
  createMemoryCancellations,
  createMemoryInvoices,
  createMemoryPaymentMethods,
  createMemorySubscriptionItems,
  createMemorySubscriptions,
  createMemoryUsage,
} from "@/domain/billing/memory";
import { createCalendarService } from "@/domain/calendar/service";
import { ConflictError, ForbiddenError, ValidationError } from "@/domain/errors";
import { createOrganizationService } from "@/domain/organization/service";
import type { Actor } from "@/domain/rbac/permissions";
import { remainingQuota } from "@/domain/billing/catalog";
import {
  createMemoryCalendars,
  createMemoryMembers,
  createMemoryOrganizations,
} from "@/test/fakes";

function mutableClock(iso: string) {
  let current = new Date(iso);
  return {
    now: () => new Date(current.getTime()),
    set(next: string | Date) {
      current = new Date(next);
    },
    addDays(days: number) {
      current = new Date(current.getTime() + days * 86_400_000);
    },
  };
}

async function setup(opts?: { chargeOk?: boolean; processorFeeCents?: number }) {
  const clock = mutableClock("2026-09-14T12:00:00.000Z");
  const organizations = createMemoryOrganizations();
  const members = createMemoryMembers();
  const calendars = createMemoryCalendars();
  const notifications: Array<{ subject: string; body: string; templateKey: string; organizationId: string }> = [];
  let chargeOk = opts?.chargeOk ?? true;
  const billing = createBillingService({
    organizations,
    subscriptions: createMemorySubscriptions(),
    items: createMemorySubscriptionItems(),
    invoices: createMemoryInvoices(),
    usage: createMemoryUsage(),
    paymentMethods: createMemoryPaymentMethods(),
    cancellations: createMemoryCancellations(),
    clock,
    charger: {
      async charge() {
        if (!chargeOk) return { ok: false, processorFeeCents: 0 };
        return { ok: true, processorFeeCents: opts?.processorFeeCents ?? 0, paymentIntentId: "pi_test" };
      },
      async refund() {
        return { refundId: "re_test" };
      },
    },
    notify: {
      async notify(input) {
        notifications.push(input);
      },
    },
  });
  const orgs = createOrganizationService({
    organizations,
    members,
    calendars,
    clock,
    entitlements: { forOrganization: (organizationId) => billing.entitlementsFor(organizationId) },
  });
  const calendarService = createCalendarService({
    calendars,
    clock,
    limits: {
      forOrganization: (organizationId) => orgs.calendarUsage(organizationId),
    },
  });
  const organization = await orgs.createOrganization({ actorUserId: "user_1", name: "Acme" });
  await billing.ensureFreeSubscription(organization.id);
  const actor: Actor = {
    userId: "user_1",
    organizationId: organization.id,
    role: "owner",
    emailVerified: true,
  };
  const outsider: Actor = {
    userId: "user_2",
    organizationId: "org_other",
    role: "owner",
    emailVerified: true,
  };
  return {
    clock,
    billing,
    orgs,
    calendarService,
    organization,
    actor,
    outsider,
    notifications,
    setChargeOk(value: boolean) {
      chargeOk = value;
    },
  };
}

describe("pricing catalog", () => {
  it("sells Free, Plus, and Enterprise only", () => {
    expect(PRICING_GRID_DECISION.status).toBe("validated");
    expect(PRICING_GRID_DECISION.officialPlanIds).toEqual(["free", "plus", "enterprise"]);
    expect(PRICING_GRID_DECISION.pricesUsdMonthly.plus).toBe(49);
    expect(getPlan("plus").purchasable).toBe(true);
    expect(getPlan("plus").priceMonthlyCents).toBe(4900);
    expect(getPlan("starter").purchasable).toBe(false);
    expect(getPlan("pro").aliasOf).toBe("plus");
    expect(getPlan("business").listed).toBe(false);
    expect(entitlementsFor("plus").advancedAnalytics).toBe(true);
    expect(entitlementsFor("plus").ticketingPlatformFeeBps).toBe(0);
    expect(entitlementsFor("free").apiEnabled).toBe(false);
    expect(entitlementsFor("free").ticketingPlatformFeeBps).toBe(250);
    expect(entitlementsFor("enterprise").ssoEnabled).toBe(true);
    expect(entitlementsFor("free").aiEnabled).toBe(true);
    expect(entitlementsFor("plus").aiEnabled).toBe(true);
  });
});

describe("billing", () => {
  it("upgrades immediately after a transparent quote", async () => {
    const { billing, actor } = await setup();
    const quote = await billing.quoteChange(actor, { planId: "plus" });
    expect(quote.change).toBe("upgrade");
    expect(quote.priceCents).toBeGreaterThan(0);
    expect(quote.lines.map((line) => line.kind)).toEqual(["plan", "tax", "platform_fee"]);
    expect(quote.totalCents).toBe(quote.priceCents + quote.taxCents + quote.platformFeeCents + quote.addOnCents);
    expect(quote.pricingGridDecision).toBe("validated");
    const result = await billing.startCheckout(actor, quote);
    expect(result.subscription.planId).toBe("plus");
    expect(result.invoice?.status).toBe("paid");
    const entitlements = await billing.entitlementsFor(actor.organizationId);
    expect(entitlements.maxCalendars).toBe(25);
    expect(entitlements.planId).toBe("plus");
  });

  it("schedules downgrades at period end without taking payment", async () => {
    const { billing, actor, clock } = await setup();
    await billing.startCheckout(actor, await billing.quoteChange(actor, { planId: "plus" }));
    const quote = await billing.quoteChange(actor, { planId: "free" });
    expect(quote.change).toBe("downgrade");
    expect(quote.totalCents).toBe(0);
    const result = await billing.startCheckout(actor, quote);
    expect(result.subscription.pendingPlanId).toBe("free");
    expect((await billing.entitlementsFor(actor.organizationId)).planId).toBe("plus");
    clock.set(result.subscription.currentPeriodEnd);
    await billing.processRenewals();
    expect((await billing.entitlementsFor(actor.organizationId)).planId).toBe("free");
  });

  it("cancels with confirmation then email and no dark pattern", async () => {
    const { billing, actor, notifications, clock } = await setup();
    await billing.startCheckout(actor, await billing.quoteChange(actor, { planId: "plus" }));
    const pending = await billing.requestCancellation(actor);
    expect(pending.status).toBe("pending_confirmation");
    await expect(billing.confirmCancellation(actor, "wrong")).rejects.toBeInstanceOf(ValidationError);
    const confirmed = await billing.confirmCancellation(actor, pending.confirmationToken);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.emailSentAt).toBeTruthy();
    expect(notifications.some((item) => item.templateKey === "billing_cancellation")).toBe(true);
    const overview = await billing.overview(actor);
    expect(overview.subscription.cancelAtPeriodEnd).toBe(true);
    expect(overview.entitlements.planId).toBe("plus");
    clock.set(overview.subscription.currentPeriodEnd);
    await billing.processRenewals();
    expect((await billing.entitlementsFor(actor.organizationId)).planId).toBe("free");
  });

  it("renews a paid plan and notifies at J-14 and J-7", async () => {
    const { billing, actor, clock, notifications } = await setup();
    const upgraded = await billing.startCheckout(actor, await billing.quoteChange(actor, { planId: "plus" }));
    clock.set(new Date(upgraded.subscription.currentPeriodEnd.getTime() - 14 * 86_400_000));
    const first = await billing.processRenewalNotices();
    expect(first.map((item) => item.days)).toContain(14);
    clock.set(new Date(upgraded.subscription.currentPeriodEnd.getTime() - 7 * 86_400_000));
    const second = await billing.processRenewalNotices();
    expect(second.map((item) => item.days)).toContain(7);
    expect(notifications.filter((item) => item.templateKey === "billing_renewal")).toHaveLength(2);
    clock.set(upgraded.subscription.currentPeriodEnd);
    const renewed = await billing.processRenewals();
    expect(renewed[0]?.planId).toBe("plus");
    const invoices = (await billing.overview(actor)).invoices;
    expect(invoices.filter((item) => item.quote.change === "renewal").length).toBeGreaterThan(0);
  });

  it("enters grace after a failed payment then reverts to free", async () => {
    const ctx = await setup();
    await ctx.billing.startCheckout(ctx.actor, await ctx.billing.quoteChange(ctx.actor, { planId: "plus" }));
    ctx.setChargeOk(false);
    ctx.clock.set((await ctx.billing.overview(ctx.actor)).subscription.currentPeriodEnd);
    await ctx.billing.processRenewals();
    const pastDue = await ctx.billing.overview(ctx.actor);
    expect(pastDue.subscription.status).toBe("past_due");
    expect(pastDue.entitlements.planId).toBe("plus");
    ctx.clock.addDays(7);
    await ctx.billing.processGraceExpiry();
    expect((await ctx.billing.entitlementsFor(ctx.actor.organizationId)).planId).toBe("free");
  });

  it("gates features through entitlements and calendar limits", async () => {
    const { billing, actor, calendarService, orgs } = await setup();
    expect(entitlementsFor("free").ssoEnabled).toBe(false);
    expect(entitlementsFor("enterprise").ssoEnabled).toBe(true);
    await calendarService.createCalendar(actor, { name: "One" });
    await calendarService.createCalendar(actor, { name: "Two" });
    await calendarService.createCalendar(actor, { name: "Three" });
    await expect(calendarService.createCalendar(actor, { name: "Four" })).rejects.toBeInstanceOf(ValidationError);
    await billing.startCheckout(actor, await billing.quoteChange(actor, { planId: "plus" }));
    const usage = await orgs.calendarUsage(actor.organizationId);
    expect(usage.limit).toBe(25);
    expect(remainingQuota(usage.used, usage.limit)).toBe(22);
    const fourth = await calendarService.createCalendar(actor, { name: "Four" });
    expect(fourth.name).toBe("Four");
  });

  it("refunds paid invoices within 30 days excluding transaction fees", async () => {
    const { billing, actor } = await setup({ processorFeeCents: 80 });
    const paid = await billing.startCheckout(actor, await billing.quoteChange(actor, { planId: "plus" }));
    const invoice = paid.invoice!;
    const refunded = await billing.requestRefund(actor, invoice.id);
    expect(refunded.status).toBe("refunded");
    expect(refunded.refundedCents).toBe(invoice.totalCents - invoice.platformFeeCents - 80);
  });

  it("isolates tenants and rejects unpriced plans", async () => {
    const { billing, actor, orgs } = await setup();
    await billing.startCheckout(actor, await billing.quoteChange(actor, { planId: "plus" }));
    const other = await orgs.createOrganization({ actorUserId: "user_2", name: "Other" });
    await billing.ensureFreeSubscription(other.id);
    const otherActor: Actor = {
      userId: "user_2",
      organizationId: other.id,
      role: "owner",
      emailVerified: true,
    };
    expect((await billing.overview(actor)).catalog.map((plan) => plan.id)).toEqual([
      "free",
      "plus",
      "enterprise",
    ]);
    const own = await billing.overview(actor);
    const theirs = await billing.overview(otherActor);
    expect(theirs.subscription.organizationId).toBe(other.id);
    expect(theirs.subscription.id).not.toBe(own.subscription.id);
    expect(theirs.invoices).toEqual([]);
    await expect(billing.requestRefund(otherActor, own.invoices[0]!.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(billing.quoteChange(actor, { planId: "starter" })).rejects.toBeInstanceOf(ValidationError);
    await expect(billing.quoteChange(actor, { planId: "business" })).rejects.toBeInstanceOf(ValidationError);
    await expect(billing.quoteChange(actor, { planId: "enterprise" })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      billing.startCheckout(otherActor, await billing.quoteChange(actor, { planId: "plus" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("records usage against the current billing period", async () => {
    const { billing, actor } = await setup();
    await billing.recordUsage(actor.organizationId, "email_sends", 10);
    await billing.recordUsage(actor.organizationId, "email_sends", 5);
    expect(await billing.usageFor(actor.organizationId, "email_sends")).toBe(15);
  });

  it("does not cancel without the confirmation step", async () => {
    const { billing, actor } = await setup();
    await billing.startCheckout(actor, await billing.quoteChange(actor, { planId: "plus" }));
    await billing.requestCancellation(actor);
    expect((await billing.overview(actor)).subscription.cancelAtPeriodEnd).toBe(false);
    await expect(billing.confirmCancellation(actor, "")).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a second unconfirmed cancellation race as the same pending request", async () => {
    const { billing, actor } = await setup();
    await billing.startCheckout(actor, await billing.quoteChange(actor, { planId: "plus" }));
    const first = await billing.requestCancellation(actor);
    const second = await billing.requestCancellation(actor);
    expect(second.id).toBe(first.id);
    await billing.confirmCancellation(actor, first.confirmationToken);
    await expect(billing.requestCancellation(actor)).rejects.toBeInstanceOf(ConflictError);
  });
});
