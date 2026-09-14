import { describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, ValidationError } from "@/domain/errors";
import { PaymentNotConfiguredError } from "@/domain/calendar/membership-types";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import { createRegistrationService } from "@/domain/event/registration-service";
import { checkoutIdempotencyKey } from "@/domain/payments/checkout";
import { DEFAULT_PLATFORM_FEE_BPS, platformFeeCents } from "@/domain/payments/fees";
import {
  memoryCheckoutPayments,
  memoryConnectedAccounts,
  memoryIssuedTickets,
  memoryPaymentRefunds,
  memoryStripeWebhooks,
  memoryTaxPort,
  memoryTaxRecords,
  recordingStripeConnect,
} from "@/domain/payments/memory";
import { quotePayment } from "@/domain/payments/quote";
import { createPaymentService } from "@/domain/payments/service";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryAddOns,
  createMemoryCalendars,
  createMemoryCoupons,
  createMemoryEvents,
  createMemoryOrders,
  createMemoryRegistrations,
  createMemoryTickets,
} from "@/test/fakes";

const owner: Actor = {
  userId: "user_1",
  organizationId: "org_1",
  role: "owner",
  emailVerified: true,
};

async function setup(options?: { failCheckout?: boolean; taxCents?: number; configured?: boolean }) {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const registrations = createMemoryRegistrations();
  const tickets = createMemoryTickets();
  const coupons = createMemoryCoupons();
  const addOns = createMemoryAddOns();
  const orders = createMemoryOrders();
  const accounts = memoryConnectedAccounts();
  const checkoutPayments = memoryCheckoutPayments();
  const refunds = memoryPaymentRefunds();
  const issuedTickets = memoryIssuedTickets();
  const webhooks = memoryStripeWebhooks();
  const taxRecords = memoryTaxRecords();
  const stripe = recordingStripeConnect({
    failCheckout: options?.failCheckout,
    configured: options?.configured,
  });
  const tax = memoryTaxPort(options?.taxCents ?? 0);
  const notices: string[] = [];
  const payments = createPaymentService({
    accounts,
    payments: checkoutPayments,
    refunds,
    issuedTickets,
    webhooks,
    taxRecords,
    orders,
    registrations,
    events,
    stripe,
    tax,
    appUrl: "http://localhost:3000",
    notify: {
      async notify(input) {
        notices.push(`${input.kind}:${input.email}`);
      },
    },
  });
  await accounts.upsert({
    id: "ca_1",
    organizationId: "org_1",
    stripeAccountId: "acct_test",
    chargesEnabled: true,
    payoutsEnabled: true,
    kycStatus: "verified",
    payoutStatus: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const register = createRegistrationService({
    events,
    registrations,
    tickets,
    coupons,
    addOns,
    orders,
    payments: stripe,
    ledger: {
      accounts,
      checkoutPayments,
      tax,
      taxRecords,
      issuedTickets,
      requireConnectedAccount: (organizationId) => payments.requireConnectedAccount(organizationId),
      issueTickets: (input) => payments.issueTickets(input),
      refundEventCancellation: (organizationId, eventId, reason) =>
        payments.refundEventCancellation(organizationId, eventId, reason),
    },
    notify: {
      async notify(input) {
        notices.push(`${input.kind}:${input.email}`);
      },
    },
  });
  const calendar = await createCalendarService({ calendars }).createCalendar(owner, {
    name: "Pay Lab",
  });
  const eventService = createEventService({
    events,
    calendars,
    registrations: register,
  });
  return {
    calendar,
    eventService,
    register,
    tickets,
    coupons,
    addOns,
    orders,
    stripe,
    payments,
    issuedTickets,
    checkoutPayments,
    notices,
    accounts,
    registrations,
  };
}

async function paidEvent(
  harness: Awaited<ReturnType<typeof setup>>,
  input?: { capacity?: number; ticketCapacity?: number; currency?: string; priceCents?: number },
) {
  const event = await harness.eventService.createEvent(owner, {
    calendarId: harness.calendar.id,
    title: "Paid night",
    startsAt: new Date("2026-11-01T18:00:00.000Z"),
    endsAt: new Date("2026-11-01T20:00:00.000Z"),
    status: "published",
    isPaid: true,
    capacity: input?.capacity ?? 20,
  });
  const ticket = await harness.tickets.create({
    id: "ga",
    organizationId: "org_1",
    eventId: event.id,
    name: "GA",
    description: null,
    priceCents: input?.priceCents ?? 2000,
    currency: input?.currency ?? "EUR",
    capacity: input?.ticketCapacity ?? null,
    salesStart: null,
    salesEnd: null,
    visibility: "public",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { event, ticket };
}

function completedWebhook(orderId: string, sessionId: string) {
  return JSON.stringify({
    id: `evt_${sessionId}`,
    type: "checkout.session.completed",
    data: { object: { id: sessionId, client_reference_id: orderId } },
  });
}

describe("payment quotes and currencies", () => {
  it("publishes the platform fee before payment and rejects mixed currencies", () => {
    const quote = quotePayment({
      tickets: [{ name: "GA", quantity: 2, unitPriceCents: 2000, currency: "EUR" }],
      addOns: [{ name: "Merch", unitPriceCents: 500, currency: "EUR" }],
      discountCents: 200,
    });
    expect(quote.ticketSubtotalCents).toBe(4000);
    expect(quote.addOnSubtotalCents).toBe(500);
    expect(quote.platformFeeBps).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(quote.platformFeeCents).toBe(platformFeeCents(4300));
    expect(quote.totalCents).toBe(4300 + quote.platformFeeCents);
    expect(quote.lines.some((line) => line.kind === "platform_fee" && line.amountCents === quote.platformFeeCents)).toBe(
      true,
    );
    expect(() =>
      quotePayment({
        tickets: [{ name: "GA", quantity: 1, unitPriceCents: 1000, currency: "EUR" }],
        addOns: [{ name: "USD add-on", unitPriceCents: 100, currency: "USD" }],
      }),
    ).toThrow(ValidationError);
  });
});

describe("ticketing checkout", () => {
  it("is idempotent on double checkout", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness);
    const first = await harness.register.purchase({
      eventId: event.id,
      email: "buyer@example.com",
      items: [{ ticketTypeId: "ga", quantity: 1 }],
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/no",
    });
    const second = await harness.register.purchase({
      eventId: event.id,
      email: "buyer@example.com",
      items: [{ ticketTypeId: "ga", quantity: 1 }],
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/no",
    });
    expect(second.order.id).toBe(first.order.id);
    expect(harness.stripe.checkouts).toHaveLength(1);
    expect(first.quote.platformFeeCents).toBeGreaterThan(0);
    expect(
      checkoutIdempotencyKey({
        eventId: event.id,
        email: "buyer@example.com",
        items: [{ ticketTypeId: "ga", quantity: 1 }],
      }),
    ).toContain("checkout:");
  });

  it("ignores a duplicated Stripe webhook and issues tickets once", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness);
    const purchase = await harness.register.purchase({
      eventId: event.id,
      email: "buyer@example.com",
      items: [{ ticketTypeId: "ga", quantity: 2 }],
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/no",
    });
    const payload = completedWebhook(purchase.order.id, purchase.order.paymentExternalId!);
    const first = await harness.payments.handleStripeWebhook(payload, "sig_test");
    const second = await harness.payments.handleStripeWebhook(payload, "sig_test");
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    const tickets = await harness.issuedTickets.listByOrder(purchase.order.id);
    expect(tickets).toHaveLength(2);
    expect(tickets.every((ticket) => ticket.code.length > 8)).toBe(true);
    const order = await harness.orders.findById(purchase.order.id);
    expect(order?.status).toBe("paid");
  });

  it("cancels a pending order when payment fails", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness);
    const purchase = await harness.register.purchase({
      eventId: event.id,
      email: "buyer@example.com",
      items: [{ ticketTypeId: "ga", quantity: 1 }],
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/no",
    });
    await harness.payments.handleStripeWebhook(
      JSON.stringify({
        id: "evt_fail",
        type: "payment_intent.payment_failed",
        data: { object: { id: purchase.order.paymentExternalId, client_reference_id: purchase.order.id } },
      }),
      "sig_test",
    );
    expect((await harness.orders.findById(purchase.order.id))?.status).toBe("cancelled");
  });

  it("rejects a checkout that Stripe declines and releases the seat", async () => {
    const harness = await setup({ failCheckout: true });
    const { event } = await paidEvent(harness, { capacity: 1, ticketCapacity: 1 });
    await expect(
      harness.register.purchase({
        eventId: event.id,
        email: "buyer@example.com",
        items: [{ ticketTypeId: "ga", quantity: 1 }],
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      }),
    ).rejects.toThrow(/card_declined/);
    const active = (await harness.registrations.listByEvent(event.id)).filter(
      (item) => item.status === "pending" || item.status === "confirmed",
    );
    expect(active).toHaveLength(0);
  });

  it("refunds an individual ticket and records the reason", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness);
    const purchase = await harness.register.purchase({
      eventId: event.id,
      email: "buyer@example.com",
      items: [{ ticketTypeId: "ga", quantity: 2 }],
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/no",
    });
    await harness.payments.handleStripeWebhook(
      completedWebhook(purchase.order.id, purchase.order.paymentExternalId!),
      "sig_test",
    );
    const tickets = await harness.issuedTickets.listByOrder(purchase.order.id);
    const refund = await harness.payments.refundOrder(owner, {
      orderId: purchase.order.id,
      issuedTicketId: tickets[0]!.id,
      reason: "attendee_cancelled",
    });
    expect(refund.kind).toBe("individual");
    expect(refund.reason).toBe("attendee_cancelled");
    expect((await harness.orders.findById(purchase.order.id))?.status).toBe("partially_refunded");
    const report = await harness.payments.report(owner);
    expect(report.refundedCents).toBe(refund.amountCents);
  });

  it("refunds and emails buyers when a paid event is cancelled", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness);
    const purchase = await harness.register.purchase({
      eventId: event.id,
      email: "buyer@example.com",
      items: [{ ticketTypeId: "ga", quantity: 1 }],
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/no",
    });
    await harness.payments.handleStripeWebhook(
      completedWebhook(purchase.order.id, purchase.order.paymentExternalId!),
      "sig_test",
    );
    await harness.eventService.cancelEvent(owner, event.id);
    expect((await harness.orders.findById(purchase.order.id))?.status).toBe("refunded");
    expect(harness.stripe.refunds).toHaveLength(1);
    expect(harness.notices.some((item) => item.startsWith("refund:"))).toBe(true);
    expect(harness.notices.some((item) => item.startsWith("cancelled:"))).toBe(true);
  });

  it("applies a coupon on the visible quote", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness);
    await harness.coupons.create({
      id: "c1",
      organizationId: "org_1",
      eventId: event.id,
      code: "SAVE10",
      kind: "percentage",
      amount: 10,
      usageLimit: 10,
      usedCount: 0,
      startsAt: null,
      endsAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const priced = await harness.register.quote({
      eventId: event.id,
      items: [{ ticketTypeId: "ga", quantity: 1 }],
      couponCode: "SAVE10",
    });
    expect(priced.quote.discountCents).toBe(200);
    expect(priced.quote.lines.some((line) => line.kind === "discount")).toBe(true);
  });

  it("enforces ticket-type capacity", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness, { capacity: 10, ticketCapacity: 1 });
    await harness.register.purchase({
      eventId: event.id,
      email: "one@example.com",
      items: [{ ticketTypeId: "ga", quantity: 1 }],
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/no",
    });
    await expect(
      harness.register.purchase({
        eventId: event.id,
        email: "two@example.com",
        items: [{ ticketTypeId: "ga", quantity: 1 }],
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("races the last ticket-type seat", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness, { capacity: 10, ticketCapacity: 1 });
    const attempts = await Promise.allSettled([
      harness.register.purchase({
        eventId: event.id,
        email: "one@example.com",
        items: [{ ticketTypeId: "ga", quantity: 1 }],
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      }),
      harness.register.purchase({
        eventId: event.id,
        email: "two@example.com",
        items: [{ ticketTypeId: "ga", quantity: 1 }],
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      }),
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((item) => item.status === "rejected")).toHaveLength(1);
  });

  it("rejects a refund from another tenant", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness);
    const purchase = await harness.register.purchase({
      eventId: event.id,
      email: "buyer@example.com",
      items: [{ ticketTypeId: "ga", quantity: 1 }],
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/no",
    });
    await harness.payments.handleStripeWebhook(
      completedWebhook(purchase.order.id, purchase.order.paymentExternalId!),
      "sig_test",
    );
    await expect(
      harness.payments.refundOrder({ ...owner, organizationId: "org_2" }, {
        orderId: purchase.order.id,
        reason: "wrong_tenant",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a mismatched add-on currency", async () => {
    const harness = await setup();
    const { event } = await paidEvent(harness);
    await harness.addOns.create({
      id: "addon_usd",
      organizationId: "org_1",
      eventId: event.id,
      name: "USD merch",
      priceCents: 500,
      currency: "USD",
      capacity: null,
      inventory: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      harness.register.quote({
        eventId: event.id,
        items: [{ ticketTypeId: "ga", quantity: 1 }],
        addOnIds: ["addon_usd"],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("requires Stripe Connect before paid checkout", async () => {
    const harness = await setup();
    await harness.accounts.upsert({
      id: "ca_1",
      organizationId: "org_1",
      stripeAccountId: "acct_test",
      chargesEnabled: false,
      payoutsEnabled: false,
      kycStatus: "pending",
      payoutStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { event } = await paidEvent(harness);
    await expect(
      harness.register.purchase({
        eventId: event.id,
        email: "connect-required@example.com",
        items: [{ ticketTypeId: "ga", quantity: 1 }],
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("starts Express onboarding and exposes KYC", async () => {
    const harness = await setup();
    const started = await harness.payments.startConnect(owner, { email: "org@example.com" });
    expect(started.onboardingUrl).toContain("connect.stripe.com");
    const account = await harness.payments.getConnect(owner);
    expect(account?.kycStatus).toBe("verified");
    expect(account?.payoutStatus).toBe("active");
  });

  it("does not start paid checkout without a payment provider", async () => {
    const harness = await setup({ configured: false });
    const { event } = await paidEvent(harness);
    await expect(
      harness.register.purchase({
        eventId: event.id,
        email: "unconfigured@example.com",
        items: [{ ticketTypeId: "ga", quantity: 1 }],
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/no",
      }),
    ).rejects.toBeInstanceOf(PaymentNotConfiguredError);
  });
});
