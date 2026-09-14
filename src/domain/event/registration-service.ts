import { createHash } from "node:crypto";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import { applyCoupon, isPresale } from "@/domain/event/coupons";
import type {
  AddOn,
  AddOnRepository,
  Coupon,
  CouponRepository,
  EventOrder,
  EventOrderItem,
  EventRegistration,
  EventRegistrationRepository,
  OrderRepository,
  TicketType,
  TicketTypeRepository,
} from "@/domain/event/commerce-types";
import type { Event, EventRepository } from "@/domain/event/types";
import { PaymentNotConfiguredError, type PaymentAdapter } from "@/domain/calendar/membership-types";
import { unconfiguredPaymentAdapter } from "@/integrations/payments/unconfigured";
import { checkoutIdempotencyKey } from "@/domain/payments/checkout";
import { DEFAULT_PLATFORM_FEE_BPS } from "@/domain/payments/fees";
import { quotePayment, type PaymentQuote } from "@/domain/payments/quote";
import type { PaymentService } from "@/domain/payments/service";
import type {
  CheckoutPaymentRepository,
  ConnectedAccountRepository,
  IssuedTicketRepository,
  TaxPort,
  TaxRecordRepository,
} from "@/domain/payments/types";
import { memoryTaxPort } from "@/domain/payments/memory";
import type { CaptchaVerifier } from "@/domain/privacy/types";
import { assessPaymentRisk } from "@/domain/privacy/risk";
import { incrementVelocity } from "@/domain/privacy/velocity";
import { emitIntegrationEvent } from "@/domain/integration/emit";
import type { IntegrationEmitter } from "@/domain/integration/types";
import { emitPublicWebhook } from "@/domain/public-api/service";
import type { PublicWebhookEvent } from "@/domain/public-api/types";
import type { EntitlementResolver } from "@/domain/billing/entitlements";
import { assertQuota } from "@/domain/billing/entitlements";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export const WAITLIST_OFFER_MS = 24 * 60 * 60 * 1000;

export type RegistrationNotifier = {
  notify: (input: {
    email: string;
    subject: string;
    body: string;
    kind: "registration" | "waitlist.offer" | "cancelled" | "postponed" | "refund";
  }) => Promise<void>;
};

export type WaitlistScheduler = {
  scheduleOfferExpiry: (input: {
    eventId: string;
    registrationId: string;
    availableAt: Date;
  }) => Promise<void>;
};

export type RegistrationLedger = {
  accounts: ConnectedAccountRepository;
  checkoutPayments: CheckoutPaymentRepository;
  tax: TaxPort;
  taxRecords: TaxRecordRepository;
  issuedTickets: IssuedTicketRepository;
  requireConnectedAccount: PaymentService["requireConnectedAccount"];
  issueTickets: PaymentService["issueTickets"];
  refundEventCancellation?: PaymentService["refundEventCancellation"];
  platformFeeBps?: number;
};

export type RegistrationServiceDeps = {
  events: EventRepository;
  registrations: EventRegistrationRepository;
  tickets: TicketTypeRepository;
  coupons: CouponRepository;
  addOns: AddOnRepository;
  orders: OrderRepository;
  payments?: PaymentAdapter;
  ledger?: RegistrationLedger;
  notify?: RegistrationNotifier;
  schedule?: WaitlistScheduler;
  captcha?: CaptchaVerifier;
  integrations?: IntegrationEmitter;
  publicWebhooks?: { emit: (event: PublicWebhookEvent) => Promise<void> };
  entitlements?: EntitlementResolver;
  clientIp?: string | null;
  ipCountry?: string | null;
  billingCountry?: string | null;
  accountAgeMs?: number | null;
  clock?: Clock;
  ids?: IdGenerator;
};

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

export function createRegistrationService(deps: RegistrationServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const payments = deps.payments ?? unconfiguredPaymentAdapter;

  async function assertRegistrantEntitlement(organizationId: string, eventId: string, quantity: number) {
    if (!deps.entitlements) return;
    const entitlements = await deps.entitlements.forOrganization(organizationId);
    const taken = await deps.registrations.countActive(eventId);
    assertQuota({
      used: taken,
      increment: quantity,
      limit: entitlements.maxRegistrantsPerEvent,
      metric: "registrants",
    });
  }

  async function ticketingFeeBps(organizationId: string) {
    if (deps.entitlements) {
      return (await deps.entitlements.forOrganization(organizationId)).ticketingPlatformFeeBps;
    }
    return deps.ledger?.platformFeeBps ?? DEFAULT_PLATFORM_FEE_BPS;
  }

  async function requireEvent(eventId: string): Promise<Event> {
    const event = await deps.events.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    return event;
  }

  function assertAccess(
    event: Event,
    input: { email: string; password?: string; token?: string; invitation?: boolean },
  ) {
    if (event.registrationMode === "invitation" && !input.invitation) {
      throw new ForbiddenError("This event is invitation-only");
    }
    if (event.registrationMode === "password") {
      if (!input.password || !event.registrationPasswordHash) {
        throw new ForbiddenError("A registration password is required");
      }
      if (hashSecret(input.password) !== event.registrationPasswordHash) {
        throw new ForbiddenError("Invalid registration password");
      }
    }
    if (event.registrationMode === "email_domain") {
      const domain = emailDomain(input.email);
      if (!event.allowedEmailDomains.includes(domain)) {
        throw new ForbiddenError("This email domain is not allowed");
      }
    }
    if (event.registrationMode === "token") {
      if (!input.token || input.token !== event.accessToken) {
        throw new ForbiddenError("A valid access token is required");
      }
    }
  }

  async function nextWaitlistPosition(eventId: string): Promise<number> {
    const list = await deps.registrations.listByEvent(eventId);
    const waitlisted = list.filter((item) => item.status === "waitlisted" || item.status === "offered");
    return waitlisted.length + 1;
  }

  async function register(input: {
    eventId: string;
    email: string;
    userId?: string | null;
    password?: string;
    token?: string;
    invitation?: boolean;
    ticketTypeId?: string;
    quantity?: number;
    occurrenceStartsAt?: Date | null;
    anonymous?: boolean;
    appearOnRoster?: boolean;
    captchaId?: string;
    captchaAnswer?: string;
  }): Promise<EventRegistration> {
    const event = await requireEvent(input.eventId);
    const email = input.email.trim().toLowerCase();
    assertAccess(event, { ...input, email });
    const anonymous = Boolean(input.anonymous);
    if ((anonymous || !input.userId) && deps.captcha) {
      await deps.captcha.verify({
        id: input.captchaId ?? "",
        answer: input.captchaAnswer ?? "",
        action: "anonymous_rsvp",
      });
    }
    incrementVelocity({
      key: `rsvp:${deps.clientIp ?? email}`,
      limit: 8,
      windowMs: 60_000,
    });

    const existing = await deps.registrations.findByEventAndEmail(event.id, email);
    if (existing && existing.status !== "cancelled" && existing.status !== "expired") {
      throw new ConflictError("This email is already registered");
    }

    const quantity = input.quantity ?? 1;
    if (quantity < 1) throw new ValidationError("Quantity must be at least 1");
    await assertRegistrantEntitlement(event.organizationId, event.id, quantity);

    const tickets = await deps.tickets.listByEvent(event.id);
    const now = clock.now();
    const presale = isPresale(tickets, now);
    if (presale && event.isPaid && !event.waitlistDuringPresale && event.capacity != null) {
      const taken = await deps.registrations.countActive(event.id);
      if (taken + quantity > event.capacity) {
        throw new ConflictError("Waitlist is disabled during paid presale");
      }
    }

    const status: EventRegistration["status"] =
      event.registrationMode === "approval" ? "pending" : "confirmed";
    const candidate: EventRegistration = {
      id: ids.id(),
      organizationId: event.organizationId,
      calendarId: event.calendarId,
      eventId: event.id,
      userId: input.userId ?? null,
      email,
      status,
      occurrenceStartsAt: input.occurrenceStartsAt ?? null,
      orderId: null,
      ticketTypeId: input.ticketTypeId ?? null,
      quantity,
      offeredUntil: null,
      waitlistPosition: null,
      anonymous,
      appearOnRoster: anonymous ? false : Boolean(input.appearOnRoster),
      createdAt: now,
      updatedAt: now,
    };

    const ticketLimits =
      input.ticketTypeId && tickets.find((ticket) => ticket.id === input.ticketTypeId)
        ? [
            {
              ticketTypeId: input.ticketTypeId,
              capacity: tickets.find((ticket) => ticket.id === input.ticketTypeId)!.capacity,
              quantity,
            },
          ]
        : undefined;
    const reserved = await deps.registrations.createIfCapacity(
      candidate,
      event.capacity,
      quantity,
      ticketLimits,
    );
    if (reserved.ok) {
      await deps.notify?.notify({
        email,
        kind: "registration",
        subject: `You're registered for ${event.title}`,
        body: `Your registration for ${event.title} is confirmed.`,
      });
      await emitIntegrationEvent(deps.integrations, {
        type: "registrant.created",
        organizationId: event.organizationId,
        eventId: event.id,
        registrationId: reserved.registration.id,
        email,
        status: reserved.registration.status,
      });
      await emitPublicWebhook(deps.publicWebhooks, {
        type: "rsvp.created",
        organizationId: event.organizationId,
        data: { id: reserved.registration.id, eventId: event.id, status: reserved.registration.status },
      });
      return reserved.registration;
    }

    if (!event.waitlistEnabled || (presale && event.isPaid && !event.waitlistDuringPresale)) {
      throw new ConflictError("This event is at capacity");
    }
    const waitlisted = await deps.registrations.create({
      ...candidate,
      id: ids.id(),
      status: "waitlisted",
      waitlistPosition: await nextWaitlistPosition(event.id),
    });
    await emitIntegrationEvent(deps.integrations, {
      type: "registrant.created",
      organizationId: event.organizationId,
      eventId: event.id,
      registrationId: waitlisted.id,
      email,
      status: waitlisted.status,
    });
    await emitPublicWebhook(deps.publicWebhooks, {
      type: "rsvp.created",
      organizationId: event.organizationId,
      data: { id: waitlisted.id, eventId: event.id, status: waitlisted.status },
    });
    return waitlisted;
  }

  async function quote(input: {
    eventId: string;
    items: Array<{ ticketTypeId: string; quantity: number }>;
    addOnIds?: string[];
    couponCode?: string;
    taxExemptionCode?: string;
    billingCountry?: string;
    billingPostalCode?: string;
  }): Promise<{
    quote: PaymentQuote;
    ticketRows: Array<{ ticket: TicketType; quantity: number }>;
    addOns: AddOn[];
    coupon: Coupon | null;
    taxCalculationId: string | null;
  }> {
    const event = await requireEvent(input.eventId);
    if (input.items.length === 0) throw new ValidationError("At least one ticket is required");
    const now = clock.now();
    const ticketRows: Array<{ ticket: TicketType; quantity: number }> = [];
    for (const item of input.items) {
      const ticket = await deps.tickets.findById(item.ticketTypeId);
      if (!ticket || ticket.eventId !== event.id) {
        throw new NotFoundError("TicketType", item.ticketTypeId);
      }
      if (item.quantity < 1) throw new ValidationError("Ticket quantity must be at least 1");
      if (ticket.salesStart && now < ticket.salesStart) {
        throw new ValidationError("Ticket sales have not started");
      }
      if (ticket.salesEnd && now > ticket.salesEnd) {
        throw new ValidationError("Ticket sales have ended");
      }
      ticketRows.push({ ticket, quantity: item.quantity });
    }

    const addOns: AddOn[] = [];
    for (const addOnId of input.addOnIds ?? []) {
      const addOn = await deps.addOns.findById(addOnId);
      if (!addOn || addOn.eventId !== event.id) throw new NotFoundError("AddOn", addOnId);
      if (addOn.inventory != null && addOn.inventory < 1) {
        throw new ConflictError("This add-on is sold out");
      }
      addOns.push(addOn);
    }

    const merchandise =
      ticketRows.reduce((sum, row) => sum + row.ticket.priceCents * row.quantity, 0) +
      addOns.reduce((sum, addOn) => sum + addOn.priceCents, 0);
    let coupon: Coupon | null = null;
    let discount = 0;
    if (input.couponCode) {
      coupon = await deps.coupons.findByCode(input.couponCode.trim().toUpperCase());
      if (!coupon) throw new NotFoundError("Coupon");
      discount = applyCoupon(coupon, event.id, merchandise, now).discountCents;
    }

    const taxPort = deps.ledger?.tax ?? memoryTaxPort(0);
    const tax = await taxPort.calculate({
      currency: ticketRows[0]?.ticket.currency ?? "EUR",
      amountCents: Math.max(0, merchandise - discount),
      exemptionCode: input.taxExemptionCode,
      address: input.billingCountry
        ? { country: input.billingCountry, postalCode: input.billingPostalCode }
        : null,
    });

    return {
      quote: quotePayment({
        tickets: ticketRows.map((row) => ({
          name: row.ticket.name,
          quantity: row.quantity,
          unitPriceCents: row.ticket.priceCents,
          currency: row.ticket.currency,
        })),
        addOns: addOns.map((addOn) => ({
          name: addOn.name,
          quantity: 1,
          unitPriceCents: addOn.priceCents,
          currency: addOn.currency,
        })),
        discountCents: discount,
        taxCents: tax.taxCents,
        taxConfigured: taxPort.isConfigured(),
        platformFeeBps: await ticketingFeeBps(event.organizationId),
      }),
      ticketRows,
      addOns,
      coupon,
      taxCalculationId: tax.calculationId,
    };
  }

  async function purchase(input: {
    eventId: string;
    email: string;
    userId?: string | null;
    items: Array<{ ticketTypeId: string; quantity: number }>;
    addOnIds?: string[];
    couponCode?: string;
    taxExemptionCode?: string;
    billingCountry?: string;
    billingPostalCode?: string;
    password?: string;
    token?: string;
    successUrl: string;
    cancelUrl: string;
    anonymous?: boolean;
    appearOnRoster?: boolean;
    captchaId?: string;
    captchaAnswer?: string;
    require3ds?: boolean;
  }): Promise<{
    order: EventOrder;
    checkoutUrl: string | null;
    registrations: EventRegistration[];
    require3ds: boolean;
    riskSignals: string[];
    quote: PaymentQuote;
    alreadyPaid: boolean;
  }> {
    const event = await requireEvent(input.eventId);
    const email = input.email.trim().toLowerCase();
    assertAccess(event, { email, password: input.password, token: input.token });
    const anonymous = Boolean(input.anonymous);
    if ((anonymous || !input.userId) && deps.captcha) {
      await deps.captcha.verify({
        id: input.captchaId ?? "",
        answer: input.captchaAnswer ?? "",
        action: "anonymous_rsvp",
      });
    }
    const velocityHits = incrementVelocity({
      key: `pay:${deps.clientIp ?? email}`,
      limit: 8,
      windowMs: 60_000,
    });

    const priced = await quote({
      eventId: event.id,
      items: input.items,
      addOnIds: input.addOnIds,
      couponCode: input.couponCode,
      taxExemptionCode: input.taxExemptionCode,
      billingCountry: input.billingCountry ?? deps.billingCountry ?? undefined,
      billingPostalCode: input.billingPostalCode,
    });
    const { quote: paymentQuote, ticketRows, addOns, coupon } = priced;
    const now = clock.now();
    let idempotencyKey = checkoutIdempotencyKey({
      eventId: event.id,
      email,
      items: input.items,
      addOnIds: input.addOnIds,
      couponCode: input.couponCode,
      taxExemptionCode: input.taxExemptionCode,
    });
    const existing = await deps.orders.findByIdempotencyKey(idempotencyKey);
    if (existing && (existing.status === "pending" || existing.status === "paid")) {
      const payment = await deps.ledger?.checkoutPayments.findByOrderId(existing.id);
      return {
        order: existing,
        checkoutUrl: payment?.checkoutUrl ?? null,
        registrations: (await deps.registrations.listByEvent(event.id)).filter(
          (item) => item.orderId === existing.id,
        ),
        require3ds: false,
        riskSignals: ["idempotent_replay"],
        quote: paymentQuote,
        alreadyPaid: existing.status === "paid",
      };
    }
    if (existing) {
      idempotencyKey = `${idempotencyKey}:${ids.id()}`;
    }

    if (paymentQuote.totalCents > 0 && !payments.isConfigured()) throw new PaymentNotConfiguredError();
    const quantity = ticketRows.reduce((sum, row) => sum + row.quantity, 0);
    await assertRegistrantEntitlement(event.organizationId, event.id, quantity);
    const orderId = ids.id();
    const reserved = await deps.registrations.createIfCapacity(
      {
        id: ids.id(),
        organizationId: event.organizationId,
        calendarId: event.calendarId,
        eventId: event.id,
        userId: input.userId ?? null,
        email,
        status: paymentQuote.totalCents > 0 ? "pending" : "confirmed",
        occurrenceStartsAt: null,
        orderId,
        ticketTypeId: ticketRows.length === 1 ? ticketRows[0]!.ticket.id : null,
        quantity,
        offeredUntil: null,
        waitlistPosition: null,
        anonymous,
        appearOnRoster: anonymous ? false : Boolean(input.appearOnRoster),
        createdAt: now,
        updatedAt: now,
      },
      event.capacity,
      quantity,
      ticketRows.map((row) => ({
        ticketTypeId: row.ticket.id,
        capacity: row.ticket.capacity,
        quantity: row.quantity,
      })),
    );
    if (!reserved.ok) {
      throw new ConflictError("Not enough remaining seats for this group purchase");
    }
    const reservedRows = [reserved.registration];
    await emitIntegrationEvent(deps.integrations, {
      type: "registrant.created",
      organizationId: event.organizationId,
      eventId: event.id,
      registrationId: reserved.registration.id,
      email,
      status: reserved.registration.status,
    });
    await emitPublicWebhook(deps.publicWebhooks, {
      type: "rsvp.created",
      organizationId: event.organizationId,
      data: { id: reserved.registration.id, eventId: event.id, status: reserved.registration.status },
    });

    if (coupon) {
      await deps.coupons.save({ ...coupon, usedCount: coupon.usedCount + 1, updatedAt: now });
    }
    const items: EventOrderItem[] = [
      ...ticketRows.map((row) => ({
        id: ids.id(),
        organizationId: event.organizationId,
        orderId,
        ticketTypeId: row.ticket.id,
        addOnId: null,
        quantity: row.quantity,
        unitPriceCents: row.ticket.priceCents,
      })),
      ...addOns.map((addOn) => ({
        id: ids.id(),
        organizationId: event.organizationId,
        orderId,
        ticketTypeId: null,
        addOnId: addOn.id,
        quantity: 1,
        unitPriceCents: addOn.priceCents,
      })),
    ];

    let paymentExternalId: string | null = null;
    let checkoutUrl: string | null = null;
    let paymentIntentId: string | null = null;
    let status: EventOrder["status"] = "paid";
    let connectedAccountId: string | null = null;
    const risk = assessPaymentRisk({
      amountCents: paymentQuote.totalCents,
      currency: paymentQuote.currency,
      buyerUserId: input.userId,
      email,
      billingCountry: deps.billingCountry,
      ipCountry: deps.ipCountry,
      accountAgeMs: deps.accountAgeMs,
      velocityHits,
    });
    const require3ds = input.require3ds ?? risk.require3ds;

    if (paymentQuote.totalCents > 0) {
      const account = deps.ledger
        ? await deps.ledger.requireConnectedAccount(event.organizationId)
        : null;
      connectedAccountId = account?.stripeAccountId ?? null;
      try {
        const checkout = await payments.createCheckout({
          membershipId: orderId,
          amountCents: paymentQuote.totalCents,
          currency: paymentQuote.currency,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          require3ds,
          applicationFeeCents: paymentQuote.platformFeeCents + paymentQuote.taxCents,
          connectedAccountId: connectedAccountId ?? undefined,
          idempotencyKey,
          automaticTax: deps.ledger?.tax.isConfigured(),
          lineItems: [
            {
              name: "Tickets & add-ons",
              quantity: 1,
              unitAmountCents: paymentQuote.merchandiseCents,
            },
            ...(paymentQuote.platformFeeCents > 0
              ? [
                  {
                    name: `Platform fee (${(paymentQuote.platformFeeBps / 100).toFixed(2)}%)`,
                    quantity: 1,
                    unitAmountCents: paymentQuote.platformFeeCents,
                  },
                ]
              : []),
            ...(paymentQuote.taxCents > 0
              ? [{ name: "Tax", quantity: 1, unitAmountCents: paymentQuote.taxCents }]
              : []),
          ],
        });
        paymentExternalId = checkout.externalId;
        checkoutUrl = checkout.checkoutUrl;
        paymentIntentId = checkout.paymentIntentId ?? null;
        status = "pending";
      } catch (error) {
        for (const registration of reservedRows) {
          await deps.registrations.save({ ...registration, status: "cancelled", updatedAt: clock.now() });
        }
        throw error;
      }
    }

    const order = await deps.orders.create(
      {
        id: orderId,
        organizationId: event.organizationId,
        eventId: event.id,
        buyerEmail: email,
        buyerUserId: input.userId ?? null,
        status,
        subtotalCents: paymentQuote.merchandiseCents + paymentQuote.discountCents,
        ticketSubtotalCents: paymentQuote.ticketSubtotalCents,
        addOnSubtotalCents: paymentQuote.addOnSubtotalCents,
        discountCents: paymentQuote.discountCents,
        taxCents: paymentQuote.taxCents,
        platformFeeCents: paymentQuote.platformFeeCents,
        totalCents: paymentQuote.totalCents,
        currency: paymentQuote.currency,
        couponId: coupon?.id ?? null,
        paymentExternalId,
        idempotencyKey,
        connectedAccountId,
        createdAt: now,
        updatedAt: now,
      },
      items,
    );

    if (deps.ledger) {
      await deps.ledger.checkoutPayments.create({
        id: ids.id(),
        organizationId: event.organizationId,
        orderId: order.id,
        amountCents: paymentQuote.totalCents,
        currency: paymentQuote.currency,
        status: status === "paid" ? "paid" : "pending",
        stripeCheckoutSessionId: paymentExternalId,
        stripePaymentIntentId: paymentIntentId,
        checkoutUrl,
        applicationFeeCents: paymentQuote.platformFeeCents + paymentQuote.taxCents,
        taxCents: paymentQuote.taxCents,
        createdAt: now,
        updatedAt: now,
      });
      await deps.ledger.taxRecords.create({
        id: ids.id(),
        organizationId: event.organizationId,
        orderId: order.id,
        currency: paymentQuote.currency,
        taxCents: paymentQuote.taxCents,
        exemptionCode: input.taxExemptionCode ?? null,
        stripeCalculationId: priced.taxCalculationId,
        createdAt: now,
      });
    }

    for (const addOn of addOns) {
      if (addOn.inventory != null) {
        await deps.addOns.save({
          ...addOn,
          inventory: addOn.inventory - 1,
          updatedAt: now,
        });
      }
    }

    const registrations: EventRegistration[] = [];
    for (const reserved of reservedRows) {
      const saved = await deps.registrations.save({
        ...reserved,
        email,
        orderId: order.id,
        status: status === "paid" ? "confirmed" : reserved.status,
        updatedAt: now,
      });
      registrations.push(saved);
      if (status === "paid" && deps.ledger) {
        await deps.ledger.issueTickets({
          order,
          registration: saved,
          quantity: saved.quantity,
          ticketTypeId: saved.ticketTypeId,
        });
      }
    }

    return {
      order,
      checkoutUrl,
      registrations,
      require3ds,
      riskSignals: risk.signals,
      quote: paymentQuote,
      alreadyPaid: status === "paid",
    };
  }

  async function refundPaidOrders(event: Event): Promise<number> {
    if (deps.ledger?.refundEventCancellation && payments.isConfigured()) {
      const refunds = await deps.ledger.refundEventCancellation(
        event.organizationId,
        event.id,
        `Event cancelled: ${event.title}`,
      );
      return refunds.length;
    }
    const list = await deps.orders.listByEvent(event.id);
    let processed = 0;
    for (const order of list) {
      if (order.status === "pending") {
        await deps.orders.save({ ...order, status: "cancelled", updatedAt: clock.now() });
        processed += 1;
        continue;
      }
      if (order.status !== "paid") continue;
      if (!payments.isConfigured()) {
        await deps.orders.save({ ...order, status: "refund_pending", updatedAt: clock.now() });
        await deps.notify?.notify({
          email: order.buyerEmail,
          kind: "refund",
          subject: `Refund pending for ${event.title}`,
          body: `A refund for ${event.title} is waiting until a payment provider is configured.`,
        });
        processed += 1;
        continue;
      }
      if (order.paymentExternalId) {
        await payments.refund({ externalId: order.paymentExternalId });
      }
      await deps.orders.save({ ...order, status: "refunded", updatedAt: clock.now() });
      await deps.notify?.notify({
        email: order.buyerEmail,
        kind: "refund",
        subject: `Refund issued for ${event.title}`,
        body: `Your payment for ${event.title} has been refunded.`,
      });
      processed += 1;
    }
    return processed;
  }

  async function promoteWaitlist(eventId: string): Promise<EventRegistration | null> {
    const event = await requireEvent(eventId);
    const list = (await deps.registrations.listByEvent(eventId))
      .filter((item) => item.status === "waitlisted")
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0) || a.createdAt.getTime() - b.createdAt.getTime());
    const next = list[0];
    if (!next) return null;
    const now = clock.now();
    const offered = await deps.registrations.save({
      ...next,
      status: "offered",
      offeredUntil: new Date(now.getTime() + WAITLIST_OFFER_MS),
      updatedAt: now,
    });
    await deps.notify?.notify({
      email: offered.email,
      kind: "waitlist.offer",
      subject: `A seat opened for ${event.title}`,
      body: `A seat is reserved for you until ${offered.offeredUntil?.toISOString()}. Accept it from the event page.`,
    });
    if (offered.offeredUntil) {
      await deps.schedule?.scheduleOfferExpiry({
        eventId: event.id,
        registrationId: offered.id,
        availableAt: offered.offeredUntil,
      });
    }
    return offered;
  }

  async function acceptOffer(registrationId: string): Promise<EventRegistration> {
    const registration = await deps.registrations.findById(registrationId);
    if (!registration) throw new NotFoundError("EventRegistration", registrationId);
    const now = clock.now();
    if (registration.status !== "offered") {
      throw new ConflictError("This waitlist offer is not active");
    }
    if (registration.offeredUntil && now > registration.offeredUntil) {
      await expireOffer(registration);
      throw new ConflictError("This waitlist offer has expired");
    }
    const confirmed = await deps.registrations.save({
      ...registration,
      status: "confirmed",
      offeredUntil: null,
      waitlistPosition: null,
      updatedAt: now,
    });
    await emitIntegrationEvent(deps.integrations, {
      type: "registrant.updated",
      organizationId: confirmed.organizationId,
      eventId: confirmed.eventId,
      registrationId: confirmed.id,
      email: confirmed.email,
      status: confirmed.status,
    });
    await emitPublicWebhook(deps.publicWebhooks, {
      type: "rsvp.updated",
      organizationId: confirmed.organizationId,
      data: { id: confirmed.id, eventId: confirmed.eventId, status: confirmed.status },
    });
    return confirmed;
  }

  async function expireOffer(registration: EventRegistration): Promise<void> {
    await deps.registrations.save({
      ...registration,
      status: "expired",
      updatedAt: clock.now(),
    });
    await promoteWaitlist(registration.eventId);
  }

  async function expireDueOffers(eventId: string): Promise<number> {
    const now = clock.now();
    const due = (await deps.registrations.listByEvent(eventId)).filter(
      (item) => item.status === "offered" && item.offeredUntil && item.offeredUntil <= now,
    );
    for (const item of due) {
      await expireOffer(item);
    }
    return due.length;
  }

  async function notifyRegistrants(
    event: Event,
    kind: "cancelled" | "postponed",
    extra = "",
  ): Promise<number> {
    const list = await deps.registrations.listByEvent(event.id);
    let sent = 0;
    for (const registration of list) {
      if (registration.status === "cancelled" || registration.status === "expired") continue;
      await deps.notify?.notify({
        email: registration.email,
        kind,
        subject: `${event.title} was ${kind}`,
        body: `${event.title} was ${kind}. ${extra}`.trim(),
      });
      if (kind === "cancelled") {
        await emitIntegrationEvent(deps.integrations, {
          type: "cancellation",
          organizationId: event.organizationId,
          eventId: event.id,
          registrationId: registration.id,
          email: registration.email,
        });
        await emitPublicWebhook(deps.publicWebhooks, {
          type: "rsvp.cancelled",
          organizationId: event.organizationId,
          data: { id: registration.id, eventId: event.id, status: "cancelled" },
        });
      }
      sent += 1;
    }
    return sent;
  }

  return {
    register,
    quote,
    purchase,
    promoteWaitlist,
    acceptOffer,
    expireDueOffers,
    notifyRegistrants,
    refundPaidOrders,
    hashSecret,
  };
}
