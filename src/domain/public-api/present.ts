import type { Calendar } from "@/domain/calendar/types";
import type { EventRegistration, TicketType } from "@/domain/event/commerce-types";
import type { Event } from "@/domain/event/types";
import type { Organization } from "@/domain/organization/types";
import type { CheckoutPayment, PaymentRefund } from "@/domain/payments/types";
import type { CheckInRecord } from "@/domain/checkin/types";

export function presentOrganization(organization: Organization) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    createdAt: organization.createdAt.toISOString(),
  };
}

export function presentCalendar(calendar: Calendar) {
  return {
    id: calendar.id,
    organizationId: calendar.organizationId,
    name: calendar.name,
    slug: calendar.slug,
    description: calendar.description,
    timezone: calendar.timezone,
    visibility: calendar.visibility,
    tags: calendar.tags,
  };
}

export function presentEvent(event: Event) {
  return {
    id: event.id,
    organizationId: event.organizationId,
    calendarId: event.calendarId,
    slug: event.slug,
    title: event.title,
    description: event.description,
    status: event.status,
    visibility: event.visibility,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    timezone: event.timezone,
    isPaid: event.isPaid,
    capacity: event.capacity,
    venueName: event.venueName,
    city: event.city,
    country: event.country,
  };
}

export function presentRegistration(registration: EventRegistration) {
  return {
    id: registration.id,
    organizationId: registration.organizationId,
    eventId: registration.eventId,
    email: registration.email,
    status: registration.status,
    quantity: registration.quantity,
    ticketTypeId: registration.ticketTypeId,
    createdAt: registration.createdAt.toISOString(),
  };
}

export function presentTicketType(ticket: TicketType) {
  return {
    id: ticket.id,
    eventId: ticket.eventId,
    name: ticket.name,
    priceCents: ticket.priceCents,
    currency: ticket.currency,
    capacity: ticket.capacity,
    salesStartAt: ticket.salesStart?.toISOString() ?? null,
    salesEndAt: ticket.salesEnd?.toISOString() ?? null,
  };
}

export function presentAttendee(registration: EventRegistration) {
  return {
    id: registration.id,
    eventId: registration.eventId,
    email: registration.anonymous ? null : registration.email,
    status: registration.status,
    quantity: registration.quantity,
    anonymous: registration.anonymous,
  };
}

export function presentCheckIn(record: CheckInRecord) {
  return {
    id: record.id,
    eventId: record.eventId,
    registrationId: record.registrationId,
    source: record.source,
    checkedInAt: record.checkedInAt.toISOString(),
  };
}

export function presentPayment(payment: CheckoutPayment) {
  return {
    id: payment.id,
    organizationId: payment.organizationId,
    orderId: payment.orderId,
    amountCents: payment.amountCents,
    currency: payment.currency,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function presentRefund(refund: PaymentRefund) {
  return {
    id: refund.id,
    organizationId: refund.organizationId,
    paymentId: refund.paymentId,
    orderId: refund.orderId,
    amountCents: refund.amountCents,
    currency: refund.currency,
    reason: refund.reason,
    kind: refund.kind,
    createdAt: refund.createdAt.toISOString(),
  };
}

export const PUBLIC_EVENT_V1_FIELDS = [
  "id",
  "organizationId",
  "calendarId",
  "slug",
  "title",
  "description",
  "status",
  "visibility",
  "startsAt",
  "endsAt",
  "timezone",
  "isPaid",
  "capacity",
  "venueName",
  "city",
  "country",
] as const;
