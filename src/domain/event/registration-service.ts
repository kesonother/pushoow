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

export type RegistrationServiceDeps = {
  events: EventRepository;
  registrations: EventRegistrationRepository;
  tickets: TicketTypeRepository;
  coupons: CouponRepository;
  addOns: AddOnRepository;
  orders: OrderRepository;
  payments?: PaymentAdapter;
  notify?: RegistrationNotifier;
  schedule?: WaitlistScheduler;
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
  }): Promise<EventRegistration> {
    const event = await requireEvent(input.eventId);
    const email = input.email.trim().toLowerCase();
    assertAccess(event, { ...input, email });

    const existing = await deps.registrations.findByEventAndEmail(event.id, email);
    if (existing && existing.status !== "cancelled" && existing.status !== "expired") {
      throw new ConflictError("This email is already registered");
    }

    const quantity = input.quantity ?? 1;
    if (quantity < 1) throw new ValidationError("Quantity must be at least 1");

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
      createdAt: now,
      updatedAt: now,
    };

    const reserved = await deps.registrations.createIfCapacity(candidate, event.capacity, quantity);
    if (reserved.ok) return reserved.registration;

    if (!event.waitlistEnabled || (presale && event.isPaid && !event.waitlistDuringPresale)) {
      throw new ConflictError("This event is at capacity");
    }
    return deps.registrations.create({
      ...candidate,
      id: ids.id(),
      status: "waitlisted",
      waitlistPosition: await nextWaitlistPosition(event.id),
    });
  }

  async function purchase(input: {
    eventId: string;
    email: string;
    userId?: string | null;
    items: Array<{ ticketTypeId: string; quantity: number }>;
    addOnIds?: string[];
    couponCode?: string;
    password?: string;
    token?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ order: EventOrder; checkoutUrl: string | null; registrations: EventRegistration[] }> {
    const event = await requireEvent(input.eventId);
    if (input.items.length === 0) throw new ValidationError("At least one ticket is required");
    const email = input.email.trim().toLowerCase();
    assertAccess(event, { email, password: input.password, token: input.token });

    const now = clock.now();
    let subtotal = 0;
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
      subtotal += ticket.priceCents * item.quantity;
    }

    const addOns: AddOn[] = [];
    for (const addOnId of input.addOnIds ?? []) {
      const addOn = await deps.addOns.findById(addOnId);
      if (!addOn || addOn.eventId !== event.id) throw new NotFoundError("AddOn", addOnId);
      if (addOn.inventory != null && addOn.inventory < 1) {
        throw new ConflictError("This add-on is sold out");
      }
      addOns.push(addOn);
      subtotal += addOn.priceCents;
    }

    let discount = 0;
    let couponId: string | null = null;
    let coupon: Coupon | null = null;
    if (input.couponCode) {
      coupon = await deps.coupons.findByCode(input.couponCode.trim().toUpperCase());
      if (!coupon) throw new NotFoundError("Coupon");
      discount = applyCoupon(coupon, event.id, subtotal, now).discountCents;
      couponId = coupon.id;
    }

    const total = Math.max(0, subtotal - discount);
    if (total > 0 && !payments.isConfigured()) throw new PaymentNotConfiguredError();
    const quantity = ticketRows.reduce((sum, row) => sum + row.quantity, 0);
    const orderId = ids.id();
    const registrationId = ids.id();
    const reserved = await deps.registrations.createIfCapacity(
      {
        id: registrationId,
        organizationId: event.organizationId,
        calendarId: event.calendarId,
        eventId: event.id,
        userId: input.userId ?? null,
        email,
        status: total > 0 ? "pending" : "confirmed",
        occurrenceStartsAt: null,
        orderId,
        ticketTypeId: ticketRows.length === 1 ? ticketRows[0].ticket.id : null,
        quantity,
        offeredUntil: null,
        waitlistPosition: null,
        createdAt: now,
        updatedAt: now,
      },
      event.capacity,
      quantity,
    );
    if (!reserved.ok) {
      throw new ConflictError("Not enough remaining seats for this group purchase");
    }
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
    let status: EventOrder["status"] = "paid";
    if (total > 0) {
      if (!payments.isConfigured()) throw new PaymentNotConfiguredError();
      const checkout = await payments.createCheckout({
        membershipId: orderId,
        amountCents: total,
        currency: ticketRows[0]?.ticket.currency ?? "EUR",
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
      paymentExternalId = checkout.externalId;
      checkoutUrl = checkout.checkoutUrl;
      status = "pending";
    }

    const order = await deps.orders.create(
      {
        id: orderId,
        organizationId: event.organizationId,
        eventId: event.id,
        buyerEmail: email,
        buyerUserId: input.userId ?? null,
        status,
        subtotalCents: subtotal,
        discountCents: discount,
        totalCents: total,
        currency: ticketRows[0]?.ticket.currency ?? "EUR",
        couponId,
        paymentExternalId,
        createdAt: now,
        updatedAt: now,
      },
      items,
    );

    for (const addOn of addOns) {
      if (addOn.inventory != null) {
        await deps.addOns.save({
          ...addOn,
          inventory: addOn.inventory - 1,
          updatedAt: now,
        });
      }
    }

    const registration = await deps.registrations.save({
      ...reserved.registration,
      orderId: order.id,
      status: status === "paid" ? "confirmed" : reserved.registration.status,
      updatedAt: now,
    });

    return { order, checkoutUrl, registrations: [registration] };
  }

  async function refundPaidOrders(event: Event): Promise<number> {
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
    return deps.registrations.save({
      ...registration,
      status: "confirmed",
      offeredUntil: null,
      waitlistPosition: null,
      updatedAt: now,
    });
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
      sent += 1;
    }
    return sent;
  }

  return {
    register,
    purchase,
    promoteWaitlist,
    acceptOffer,
    expireDueOffers,
    notifyRegistrants,
    refundPaidOrders,
    hashSecret,
  };
}
