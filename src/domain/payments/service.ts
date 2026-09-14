import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import { PaymentNotConfiguredError } from "@/domain/calendar/membership-types";
import type { EventOrder, EventRegistration, OrderRepository } from "@/domain/event/commerce-types";
import type { EventRegistrationRepository } from "@/domain/event/commerce-types";
import type { EventRepository } from "@/domain/event/types";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type {
  CheckoutPayment,
  CheckoutPaymentRepository,
  ConnectedAccountRepository,
  IssuedTicketRepository,
  PaymentRefundRepository,
  StripeConnectPort,
  StripeWebhookRepository,
  TaxPort,
  TaxRecordRepository,
} from "@/domain/payments/types";
import { emitPublicWebhook } from "@/domain/public-api/service";
import type { PublicWebhookEvent } from "@/domain/public-api/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { randomToken } from "@/lib/token-crypto";

export type PaymentNotifier = {
  notify: (input: { email: string; subject: string; body: string; kind: "refund" | "cancelled" }) => Promise<void>;
};

export function kycFromStripe(input: { chargesEnabled: boolean; detailsSubmitted: boolean }) {
  if (input.chargesEnabled && input.detailsSubmitted) return "verified" as const;
  if (input.detailsSubmitted) return "restricted" as const;
  return "pending" as const;
}

export function payoutFromStripe(payoutsEnabled: boolean) {
  return payoutsEnabled ? ("active" as const) : ("pending" as const);
}

export function createPaymentService(deps: {
  accounts: ConnectedAccountRepository;
  payments: CheckoutPaymentRepository;
  refunds: PaymentRefundRepository;
  issuedTickets: IssuedTicketRepository;
  webhooks: StripeWebhookRepository;
  taxRecords: TaxRecordRepository;
  orders: OrderRepository;
  registrations: EventRegistrationRepository;
  events: EventRepository;
  stripe: StripeConnectPort;
  tax: TaxPort;
  notify?: PaymentNotifier;
  publicWebhooks?: { emit: (event: PublicWebhookEvent) => Promise<void> };
  onUnmatchedStripeEvent?: (input: { type: string; object: Record<string, unknown> }) => Promise<void>;
  appUrl: string;
  clock?: Clock;
  ids?: IdGenerator;
}) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function startConnect(actor: Actor, input: { email?: string; refreshPath?: string; returnPath?: string }) {
    assertPermission(actor, "finance:write");
    if (!deps.stripe.isConfigured()) throw new PaymentNotConfiguredError();
    const existing = await deps.accounts.findByOrganization(actor.organizationId);
    const stripeAccountId =
      existing?.stripeAccountId ??
      (await deps.stripe.createExpressAccount({ organizationId: actor.organizationId, email: input.email }))
        .stripeAccountId;
    const snapshot = await deps.stripe.retrieveAccount(stripeAccountId);
    const account = await deps.accounts.upsert({
      id: existing?.id ?? ids.id(),
      organizationId: actor.organizationId,
      stripeAccountId,
      chargesEnabled: snapshot.chargesEnabled,
      payoutsEnabled: snapshot.payoutsEnabled,
      kycStatus: kycFromStripe(snapshot),
      payoutStatus: payoutFromStripe(snapshot.payoutsEnabled),
      createdAt: existing?.createdAt ?? clock.now(),
      updatedAt: clock.now(),
    });
    const link = await deps.stripe.createAccountLink({
      stripeAccountId,
      refreshUrl: `${deps.appUrl}${input.refreshPath ?? `/dashboard/organizations/${actor.organizationId}/payments`}`,
      returnUrl: `${deps.appUrl}${input.returnPath ?? `/dashboard/organizations/${actor.organizationId}/payments`}`,
    });
    return { account, onboardingUrl: link.url };
  }

  async function getConnect(actor: Actor) {
    assertPermission(actor, "finance:read");
    const account = await deps.accounts.findByOrganization(actor.organizationId);
    if (!account) return null;
    if (!deps.stripe.isConfigured()) return account;
    const snapshot = await deps.stripe.retrieveAccount(account.stripeAccountId);
    return deps.accounts.upsert({
      ...account,
      chargesEnabled: snapshot.chargesEnabled,
      payoutsEnabled: snapshot.payoutsEnabled,
      kycStatus: kycFromStripe(snapshot),
      payoutStatus: payoutFromStripe(snapshot.payoutsEnabled),
      updatedAt: clock.now(),
    });
  }

  async function requireConnectedAccount(organizationId: string) {
    const account = await deps.accounts.findByOrganization(organizationId);
    if (!account || !account.chargesEnabled) {
      throw new ValidationError("Stripe Connect onboarding is required before paid checkout");
    }
    return account;
  }

  async function issueTickets(input: {
    order: EventOrder;
    registration: EventRegistration | null;
    quantity: number;
    ticketTypeId: string | null;
  }) {
    const existing = await deps.issuedTickets.listByOrder(input.order.id);
    if (existing.length > 0) return existing;
    const now = clock.now();
    const tickets = Array.from({ length: input.quantity }, () => ({
      id: ids.id(),
      organizationId: input.order.organizationId,
      eventId: input.order.eventId,
      orderId: input.order.id,
      registrationId: input.registration?.id ?? null,
      ticketTypeId: input.ticketTypeId,
      code: randomToken(12),
      status: "valid" as const,
      createdAt: now,
    }));
    return deps.issuedTickets.createMany(tickets);
  }

  async function markPaid(order: EventOrder, payment: CheckoutPayment) {
    const now = clock.now();
    const paid = await deps.orders.save({ ...order, status: "paid", updatedAt: now });
    await deps.payments.save({ ...payment, status: "paid", updatedAt: now });
    const regs = (await deps.registrations.listByEvent(order.eventId)).filter((item) => item.orderId === order.id);
    for (const registration of regs) {
      await deps.registrations.save({ ...registration, status: "confirmed", updatedAt: now });
      await issueTickets({
        order: paid,
        registration,
        quantity: registration.quantity,
        ticketTypeId: registration.ticketTypeId,
      });
    }
    await emitPublicWebhook(deps.publicWebhooks, {
      type: "payment.completed",
      organizationId: order.organizationId,
      data: { id: payment.id, orderId: order.id, eventId: order.eventId, amountCents: payment.amountCents },
    });
    return paid;
  }

  async function markFailed(order: EventOrder, payment: CheckoutPayment | null) {
    const now = clock.now();
    await deps.orders.save({ ...order, status: "cancelled", updatedAt: now });
    if (payment) await deps.payments.save({ ...payment, status: "failed", updatedAt: now });
    const regs = (await deps.registrations.listByEvent(order.eventId)).filter((item) => item.orderId === order.id);
    for (const registration of regs) {
      await deps.registrations.save({ ...registration, status: "cancelled", updatedAt: now });
    }
  }

  async function handleStripeWebhook(payload: string, signature: string) {
    if (!deps.stripe.isConfigured()) throw new PaymentNotConfiguredError();
    const event = deps.stripe.verifyWebhook(payload, signature);
    const seen = await deps.webhooks.findByStripeEventId(event.id);
    if (seen) return { duplicate: true, type: event.type };

    const object = (event.data.object ?? event.data) as Record<string, unknown>;
    const sessionId = typeof object.id === "string" ? object.id : null;
    const orderId = typeof object.client_reference_id === "string" ? object.client_reference_id : String(object.orderId ?? "");
    const payment =
      (sessionId ? await deps.payments.findByCheckoutSessionId(sessionId) : null) ??
      (orderId ? await deps.payments.findByOrderId(orderId) : null);
    const order = payment ? await deps.orders.findById(payment.orderId) : orderId ? await deps.orders.findById(orderId) : null;

    if (event.type === "checkout.session.completed" && order && payment) {
      await markPaid(order, payment);
    } else if (
      (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") &&
      order &&
      order.status === "pending"
    ) {
      await markFailed(order, payment);
    } else if (!order && !payment && deps.onUnmatchedStripeEvent) {
      await deps.onUnmatchedStripeEvent({ type: event.type, object });
    }
    if (event.type === "account.updated") {
      const stripeAccountId = typeof object.id === "string" ? object.id : "";
      const account = await deps.accounts.findByStripeAccountId(stripeAccountId);
      if (account) {
        const chargesEnabled = Boolean(object.charges_enabled);
        const payoutsEnabled = Boolean(object.payouts_enabled);
        await deps.accounts.upsert({
          ...account,
          chargesEnabled,
          payoutsEnabled,
          kycStatus: kycFromStripe({
            chargesEnabled,
            detailsSubmitted: Boolean(object.details_submitted),
          }),
          payoutStatus: payoutFromStripe(payoutsEnabled),
          updatedAt: clock.now(),
        });
      }
    }
    await deps.webhooks.create({
      id: ids.id(),
      stripeEventId: event.id,
      type: event.type,
      processedAt: clock.now(),
    });
    return { duplicate: false, type: event.type };
  }

  async function refundOrder(
    actor: Actor,
    input: { orderId: string; amountCents?: number; issuedTicketId?: string; reason: string },
  ) {
    assertPermission(actor, "finance:write");
    const order = await deps.orders.findById(input.orderId);
    assertSameTenant(order, actor.organizationId, "Order");
    if (!order || (order.status !== "paid" && order.status !== "partially_refunded")) {
      throw new ConflictError("Only paid orders can be refunded");
    }
    const payment = await deps.payments.findByOrderId(order.id);
    if (!payment?.stripePaymentIntentId) throw new ConflictError("No captured payment to refund");
    const previous = await deps.refunds.listByPayment(payment.id);
    const already = previous.reduce((sum, item) => sum + item.amountCents, 0);
    let amount = input.amountCents ?? order.totalCents - already;
    let kind: "individual" | "partial" | "full" = "full";
    if (input.issuedTicketId) {
      const ticket = await deps.issuedTickets.findById(input.issuedTicketId);
      if (!ticket || ticket.orderId !== order.id) throw new NotFoundError("IssuedTicket", input.issuedTicketId);
      if (ticket.status !== "valid") throw new ConflictError("This ticket was already refunded");
      const items = await deps.orders.listItems(order.id);
      const unit = items.find((item) => item.ticketTypeId === ticket.ticketTypeId)?.unitPriceCents ?? 0;
      amount = unit;
      kind = "individual";
      await deps.issuedTickets.save({ ...ticket, status: "refunded" });
    } else if (amount < order.totalCents - already) {
      kind = "partial";
    }
    if (amount <= 0) throw new ValidationError("Refund amount must be positive");
    if (already + amount > order.totalCents) throw new ValidationError("Refund exceeds captured amount");
    if (!deps.stripe.isConfigured()) throw new PaymentNotConfiguredError();
    const stripeRefund = await deps.stripe.refund({
      paymentIntentId: payment.stripePaymentIntentId ?? undefined,
      amountCents: amount,
      reason: input.reason,
      idempotencyKey: `refund:${order.id}:${kind}:${amount}:${input.issuedTicketId ?? "order"}`,
    });
    const refund = await deps.refunds.create({
      id: ids.id(),
      organizationId: order.organizationId,
      paymentId: payment.id,
      orderId: order.id,
      amountCents: amount,
      currency: order.currency,
      reason: input.reason,
      kind,
      stripeRefundId: stripeRefund.refundId,
      createdAt: clock.now(),
    });
    const fully = already + amount >= order.totalCents;
    await deps.orders.save({
      ...order,
      status: fully ? "refunded" : "partially_refunded",
      updatedAt: clock.now(),
    });
    await deps.payments.save({
      ...payment,
      status: fully ? "refunded" : "partially_refunded",
      updatedAt: clock.now(),
    });
    const regs = fully
      ? (await deps.registrations.listByEvent(order.eventId)).filter((item) => item.orderId === order.id)
      : [];
    if (fully) {
      const tickets = await deps.issuedTickets.listByOrder(order.id);
      for (const ticket of tickets) {
        if (ticket.status === "valid") await deps.issuedTickets.save({ ...ticket, status: "refunded" });
      }
      for (const registration of regs) {
        await deps.registrations.save({ ...registration, status: "cancelled", updatedAt: clock.now() });
      }
    }
    await deps.notify?.notify({
      email: order.buyerEmail,
      kind: "refund",
      subject: `Refund for order ${order.id}`,
      body: `A ${kind} refund of ${amount} ${order.currency} was issued. Reason: ${input.reason}`,
    });
    await emitPublicWebhook(deps.publicWebhooks, {
      type: "refund.issued",
      organizationId: order.organizationId,
      data: { id: refund.id, orderId: order.id, amountCents: amount, kind },
    });
    for (const registration of regs) {
      await emitPublicWebhook(deps.publicWebhooks, {
        type: "rsvp.cancelled",
        organizationId: order.organizationId,
        data: { id: registration.id, eventId: order.eventId, status: "cancelled" },
      });
    }
    return refund;
  }

  async function refundEventCancellation(organizationId: string, eventId: string, reason: string) {
    const event = await deps.events.findById(eventId);
    assertSameTenant(event, organizationId, "Event");
    const orders = await deps.orders.listByEvent(eventId);
    const refunds = [];
    for (const order of orders) {
      if (order.status === "pending") {
        await markFailed(order, await deps.payments.findByOrderId(order.id));
        continue;
      }
      if (order.status !== "paid" && order.status !== "partially_refunded") continue;
      refunds.push(
        await refundOrder(
          { userId: "system", organizationId, role: "owner" },
          { orderId: order.id, reason },
        ),
      );
    }
    return refunds;
  }

  async function report(actor: Actor) {
    assertPermission(actor, "finance:read");
    const [payments, refunds, taxes] = await Promise.all([
      deps.payments.listByOrganization(actor.organizationId),
      deps.refunds.listByOrganization(actor.organizationId),
      deps.taxRecords.listByOrganization(actor.organizationId),
    ]);
    const captured = payments.filter((item) => item.status === "paid" || item.status === "partially_refunded");
    return {
      capturedCents: captured.reduce((sum, item) => sum + item.amountCents, 0),
      refundedCents: refunds.reduce((sum, item) => sum + item.amountCents, 0),
      taxCents: taxes.reduce((sum, item) => sum + item.taxCents, 0),
      platformFeeCents: captured.reduce((sum, item) => sum + item.applicationFeeCents, 0),
      payments,
      refunds,
      taxes,
    };
  }

  return {
    startConnect,
    getConnect,
    requireConnectedAccount,
    issueTickets,
    handleStripeWebhook,
    refundOrder,
    refundEventCancellation,
    report,
    tax: deps.tax,
    stripe: deps.stripe,
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
