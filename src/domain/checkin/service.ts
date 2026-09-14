import { NotFoundError, ValidationError } from "@/domain/errors";
import { signCheckInQr, verifyCheckInQr } from "@/domain/checkin/qr";
import { checkInRealtimeHub, type CheckInRealtimeHub } from "@/domain/checkin/realtime";
import {
  CAPACITY_ALERT_THRESHOLDS,
  CHECK_IN_ELIGIBLE,
  type CapacityAlertRepository,
  type CheckInManifest,
  type CheckInNotifier,
  type CheckInPass,
  type CheckInPassRepository,
  type CheckInRecord,
  type CheckInRecordRepository,
  type CheckInResult,
  type CheckInSource,
  type GuestManifestEntry,
} from "@/domain/checkin/types";
import type { EventRegistration, EventRegistrationRepository, TicketTypeRepository } from "@/domain/event/commerce-types";
import type { Event, EventRepository } from "@/domain/event/types";
import type { createRegistrationService } from "@/domain/event/registration-service";
import type { IssuedTicket, IssuedTicketRepository } from "@/domain/payments/types";
import type { ProfileRepository } from "@/domain/profile/types";
import { emitIntegrationEvent } from "@/domain/integration/emit";
import type { IntegrationEmitter } from "@/domain/integration/types";
import { emitPublicWebhook } from "@/domain/public-api/service";
import type { PublicWebhookEvent } from "@/domain/public-api/types";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

const ON_LIST = new Set(["confirmed", "checked_in", "offered", "pending"]);

export function createCheckInService(deps: {
  events: EventRepository;
  registrations: EventRegistrationRepository;
  tickets: TicketTypeRepository;
  issuedTickets?: IssuedTicketRepository;
  passes: CheckInPassRepository;
  records: CheckInRecordRepository;
  alerts: CapacityAlertRepository;
  secret: string;
  registrationsService?: ReturnType<typeof createRegistrationService>;
  profiles?: ProfileRepository;
  listOrganizerEmails?: (organizationId: string) => Promise<string[]>;
  notify?: CheckInNotifier;
  integrations?: IntegrationEmitter;
  publicWebhooks?: { emit: (event: PublicWebhookEvent) => Promise<void> };
  realtime?: CheckInRealtimeHub;
  clock?: Clock;
  ids?: IdGenerator;
}) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const realtime = deps.realtime ?? checkInRealtimeHub;

  async function requireEvent(actor: Actor, eventId: string): Promise<Event> {
    assertPermission(actor, "checkin:manage");
    const event = await deps.events.findById(eventId);
    assertSameTenant(event, actor.organizationId, "Event");
    return event as Event;
  }

  function displayName(registration: EventRegistration, profileName?: string | null) {
    if (profileName?.trim()) return profileName.trim();
    const local = registration.email.split("@")[0] ?? registration.email;
    return registration.anonymous ? "Guest" : local;
  }

  function expiresAtFor(event: Event): Date {
    return new Date(event.endsAt.getTime() + 24 * 60 * 60 * 1000);
  }

  async function ticketFor(registration: EventRegistration): Promise<IssuedTicket | null> {
    if (!deps.issuedTickets) return null;
    if (deps.issuedTickets.listByRegistration) {
      const list = await deps.issuedTickets.listByRegistration(registration.id);
      return list[0] ?? null;
    }
    return null;
  }

  async function ensurePass(event: Event, registration: EventRegistration): Promise<CheckInPass> {
    const existing = await deps.passes.findByRegistration(registration.id);
    if (existing) return existing;
    const issued = await ticketFor(registration);
    const pass = await deps.passes.create({
      id: ids.id(),
      organizationId: event.organizationId,
      eventId: event.id,
      registrationId: registration.id,
      issuedTicketId: issued?.id ?? null,
      revokedAt: null,
      expiresAt: expiresAtFor(event),
      createdAt: clock.now(),
    });
    return pass;
  }

  function qrFor(pass: CheckInPass): string {
    return signCheckInQr(
      {
        e: pass.eventId,
        r: pass.registrationId,
        t: pass.issuedTicketId,
        x: pass.expiresAt?.getTime() ?? null,
        n: pass.id,
      },
      deps.secret,
    );
  }

  async function resultFor(
    status: CheckInResult["status"],
    registration: EventRegistration | null,
    record: CheckInRecord | null,
    profileName?: string | null,
  ): Promise<CheckInResult> {
    return {
      status,
      registrationId: registration?.id ?? null,
      displayName: registration ? displayName(registration, profileName) : null,
      checkedInAt: record?.checkedInAt.toISOString() ?? null,
      clientOpId: record?.clientOpId ?? null,
    };
  }

  async function profileNameFor(registration: EventRegistration) {
    if (!registration.userId || !deps.profiles) return null;
    const attendee = await deps.profiles.getAttendee(registration.userId);
    return attendee?.displayName ?? null;
  }

  async function publishCounter(event: Event, lastStatus: string) {
    const checkedIn = await deps.records.countByEvent(event.id);
    realtime.publish({
      eventId: event.id,
      checkedIn,
      capacity: event.capacity,
      lastStatus,
    });
    await maybeAlert(event, checkedIn);
  }

  async function maybeAlert(event: Event, checkedIn: number) {
    if (event.capacity == null || event.capacity <= 0) return;
    const ratio = (checkedIn / event.capacity) * 100;
    const emails = deps.listOrganizerEmails ? await deps.listOrganizerEmails(event.organizationId) : [];
    for (const threshold of CAPACITY_ALERT_THRESHOLDS) {
      if (ratio < threshold) continue;
      const existing = await deps.alerts.find(event.id, threshold);
      if (existing) continue;
      await deps.alerts.create({
        id: ids.id(),
        organizationId: event.organizationId,
        eventId: event.id,
        threshold,
        createdAt: clock.now(),
      });
      await deps.notify?.notifyCapacity({
        eventId: event.id,
        title: event.title,
        threshold,
        checkedIn,
        capacity: event.capacity,
        emails,
      });
    }
  }

  function classifyRegistration(
    registration: EventRegistration | null,
    ticket: IssuedTicket | null,
  ): CheckInResult["status"] | null {
    if (!registration) return "not_on_list";
    if (registration.status === "cancelled" || registration.status === "expired" || registration.status === "waitlisted") {
      return "not_on_list";
    }
    if (ticket && (ticket.status === "refunded" || ticket.status === "void")) return "revoked";
    if (!CHECK_IN_ELIGIBLE.has(registration.status)) return "not_on_list";
    return null;
  }

  async function applyCheckIn(input: {
    event: Event;
    registration: EventRegistration;
    issuedTicketId: string | null;
    actorUserId: string | null;
    source: CheckInSource;
    deviceId: string | null;
    clientOpId: string;
    checkedInAt?: Date;
  }): Promise<CheckInResult> {
    const replay = await deps.records.findByClientOpId(input.clientOpId);
    if (replay) {
      return resultFor("already_checked_in", input.registration, replay, await profileNameFor(input.registration));
    }
    const existing = await deps.records.findByRegistration(input.event.id, input.registration.id);
    if (existing) {
      return resultFor("already_checked_in", input.registration, existing, await profileNameFor(input.registration));
    }
    const now = clock.now();
    let record: CheckInRecord;
    try {
      record = await deps.records.create({
      id: ids.id(),
      organizationId: input.event.organizationId,
      eventId: input.event.id,
      registrationId: input.registration.id,
      issuedTicketId: input.issuedTicketId,
      actorUserId: input.actorUserId,
      source: input.source,
      deviceId: input.deviceId,
      clientOpId: input.clientOpId,
      checkedInAt: input.checkedInAt ?? now,
      createdAt: now,
    });
    } catch {
      const raced =
        (await deps.records.findByClientOpId(input.clientOpId)) ??
        (await deps.records.findByRegistration(input.event.id, input.registration.id));
      if (raced) {
        return resultFor("already_checked_in", input.registration, raced, await profileNameFor(input.registration));
      }
      throw new ValidationError("Unable to record check-in");
    }
    if (input.registration.status !== "checked_in") {
      await deps.registrations.save({
        ...input.registration,
        status: "checked_in",
        updatedAt: now,
      });
    }
    await publishCounter(input.event, "checked_in");
    await emitIntegrationEvent(deps.integrations, {
      type: "check_in",
      organizationId: input.event.organizationId,
      eventId: input.event.id,
      registrationId: input.registration.id,
      email: input.registration.email,
      status: "checked_in",
    });
    await emitPublicWebhook(deps.publicWebhooks, {
      type: "checkin.completed",
      organizationId: input.event.organizationId,
      data: { id: record.id, eventId: input.event.id, registrationId: input.registration.id },
    });
    return resultFor("checked_in", input.registration, record, await profileNameFor(input.registration));
  }

  async function resolveGuest(
    event: Event,
    input: {
      token?: string;
      registrationId?: string;
      ticketCode?: string;
      email?: string;
    },
  ): Promise<
    | { status: CheckInResult["status"]; registration: null; ticket: null }
    | { status: null; registration: EventRegistration; ticket: IssuedTicket | null }
  > {
    if (input.token) {
      const verified = verifyCheckInQr(input.token, deps.secret, clock.now());
      if (!verified.ok) return { status: verified.reason === "expired" ? "invalid" : "invalid", registration: null, ticket: null };
      if (verified.claims.e !== event.id) return { status: "wrong_event", registration: null, ticket: null };
      const pass = await deps.passes.findById(verified.claims.n);
      if (!pass || pass.revokedAt) return { status: "revoked", registration: null, ticket: null };
      if (pass.eventId !== event.id) return { status: "wrong_event", registration: null, ticket: null };
      const registration = await deps.registrations.findById(verified.claims.r);
      const ticket = verified.claims.t && deps.issuedTickets
        ? await deps.issuedTickets.findById(verified.claims.t)
        : await ticketFor(registration!);
      const blocked = classifyRegistration(registration, ticket);
      if (blocked) return { status: blocked, registration: null, ticket: null };
      return { status: null, registration: registration!, ticket };
    }
    if (input.ticketCode && deps.issuedTickets?.findByCode) {
      const ticket = await deps.issuedTickets.findByCode(input.ticketCode.trim());
      if (!ticket) return { status: "not_on_list", registration: null, ticket: null };
      if (ticket.eventId !== event.id) return { status: "wrong_event", registration: null, ticket: null };
      if (ticket.status === "refunded" || ticket.status === "void") {
        return { status: "revoked", registration: null, ticket: null };
      }
      const registration = ticket.registrationId
        ? await deps.registrations.findById(ticket.registrationId)
        : null;
      const blocked = classifyRegistration(registration, ticket);
      if (blocked || !registration) return { status: blocked ?? "not_on_list", registration: null, ticket: null };
      return { status: null, registration, ticket };
    }
    if (input.registrationId) {
      const registration = await deps.registrations.findById(input.registrationId);
      if (!registration || registration.eventId !== event.id) {
        return { status: registration && registration.eventId !== event.id ? "wrong_event" : "not_on_list", registration: null, ticket: null };
      }
      const ticket = await ticketFor(registration);
      const blocked = classifyRegistration(registration, ticket);
      if (blocked) return { status: blocked, registration: null, ticket: null };
      return { status: null, registration, ticket };
    }
    if (input.email) {
      const registration = await deps.registrations.findByEventAndEmail(event.id, input.email.trim().toLowerCase());
      const ticket = registration ? await ticketFor(registration) : null;
      const blocked = classifyRegistration(registration, ticket);
      if (blocked || !registration) return { status: blocked ?? "not_on_list", registration: null, ticket: null };
      return { status: null, registration, ticket };
    }
    throw new ValidationError("A QR token, ticket id, registration, or email is required");
  }

  async function checkIn(
    actor: Actor,
    input: {
      eventId: string;
      token?: string;
      registrationId?: string;
      ticketCode?: string;
      email?: string;
      clientOpId: string;
      deviceId?: string | null;
      source?: CheckInSource;
      checkedInAt?: Date;
    },
  ): Promise<CheckInResult> {
    const event = await requireEvent(actor, input.eventId);
    if (input.clientOpId) {
      const replay = await deps.records.findByClientOpId(input.clientOpId);
      if (replay) {
        const registration = await deps.registrations.findById(replay.registrationId);
        return resultFor("already_checked_in", registration, replay, registration ? await profileNameFor(registration) : null);
      }
    }
    const resolved = await resolveGuest(event, input);
    if (resolved.status) return resultFor(resolved.status, null, null);
    return applyCheckIn({
      event,
      registration: resolved.registration,
      issuedTicketId: resolved.ticket?.id ?? null,
      actorUserId: actor.userId,
      source: input.source ?? "scan",
      deviceId: input.deviceId ?? null,
      clientOpId: input.clientOpId,
      checkedInAt: input.checkedInAt,
    });
  }

  async function bulkCheckIn(
    actor: Actor,
    input: { eventId: string; registrationIds: string[]; deviceId?: string | null },
  ): Promise<CheckInResult[]> {
    const results: CheckInResult[] = [];
    for (const registrationId of input.registrationIds) {
      results.push(
        await checkIn(actor, {
          eventId: input.eventId,
          registrationId,
          clientOpId: `bulk:${input.eventId}:${registrationId}`,
          deviceId: input.deviceId,
          source: "bulk",
        }),
      );
    }
    return results;
  }

  async function checkAllIn(actor: Actor, eventId: string, deviceId?: string | null) {
    const event = await requireEvent(actor, eventId);
    const list = (await deps.registrations.listByEvent(event.id)).filter((item) => CHECK_IN_ELIGIBLE.has(item.status));
    return bulkCheckIn(
      actor,
      { eventId, registrationIds: list.map((item) => item.id), deviceId },
    );
  }

  async function sync(
    actor: Actor,
    input: {
      eventId: string;
      deviceId?: string | null;
      checkIns: Array<{
        clientOpId: string;
        registrationId?: string;
        token?: string;
        ticketCode?: string;
        checkedInAt: string;
      }>;
    },
  ) {
    const results: CheckInResult[] = [];
    for (const item of input.checkIns) {
      results.push(
        await checkIn(actor, {
          eventId: input.eventId,
          token: item.token,
          registrationId: item.registrationId,
          ticketCode: item.ticketCode,
          clientOpId: item.clientOpId,
          deviceId: input.deviceId,
          source: "sync",
          checkedInAt: new Date(item.checkedInAt),
        }),
      );
    }
    return { results, manifest: await manifest(actor, input.eventId) };
  }

  async function manifest(actor: Actor, eventId: string): Promise<CheckInManifest> {
    const event = await requireEvent(actor, eventId);
    const registrations = await deps.registrations.listByEvent(event.id);
    const ticketTypes = await deps.tickets.listByEvent(event.id);
    const typeById = new Map(ticketTypes.map((item) => [item.id, item]));
    const guests: GuestManifestEntry[] = [];
    for (const registration of registrations) {
      if (!ON_LIST.has(registration.status) && registration.status !== "checked_in") continue;
      const pass = await ensurePass(event, registration);
      const issued = await ticketFor(registration);
      const record = await deps.records.findByRegistration(event.id, registration.id);
      const revoked = Boolean(pass.revokedAt) || (issued && (issued.status === "refunded" || issued.status === "void"));
      guests.push({
        registrationId: registration.id,
        displayName: displayName(registration, await profileNameFor(registration)),
        email: registration.email,
        ticketTypeId: registration.ticketTypeId,
        ticketTypeName: registration.ticketTypeId ? (typeById.get(registration.ticketTypeId)?.name ?? null) : null,
        ticketCode: issued?.code ?? null,
        issuedTicketId: issued?.id ?? pass.issuedTicketId,
        qrToken: revoked ? "" : qrFor(pass),
        status: revoked ? "revoked" : record ? "checked_in" : registration.status,
        checkedInAt: record?.checkedInAt.toISOString() ?? null,
        quantity: registration.quantity,
      });
    }
    guests.sort((left, right) => left.displayName.localeCompare(right.displayName, undefined, { sensitivity: "base" }));
    return {
      eventId: event.id,
      organizationId: event.organizationId,
      title: event.title,
      capacity: event.capacity,
      generatedAt: clock.now().toISOString(),
      checkedIn: await deps.records.countByEvent(event.id),
      guests,
      ticketTypes: ticketTypes.map((item) => ({
        id: item.id,
        name: item.name,
        priceCents: item.priceCents,
      })),
    };
  }

  async function search(actor: Actor, eventId: string, query: string) {
    const snapshot = await manifest(actor, eventId);
    const needle = query.trim().toLowerCase();
    if (!needle) return snapshot.guests;
    return snapshot.guests.filter(
      (guest) =>
        guest.displayName.toLowerCase().includes(needle) ||
        guest.email.toLowerCase().includes(needle) ||
        (guest.ticketCode && guest.ticketCode.toLowerCase() === needle) ||
        guest.registrationId.toLowerCase() === needle,
    );
  }

  async function walkIn(
    actor: Actor,
    input: {
      eventId: string;
      email: string;
      ticketTypeId?: string;
      quantity?: number;
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    const event = await requireEvent(actor, input.eventId);
    if (!deps.registrationsService) throw new ValidationError("Walk-in registration is not available");
    if (event.isPaid) {
      const types = await deps.tickets.listByEvent(event.id);
      const ticketTypeId = input.ticketTypeId ?? (types.length === 1 ? types[0]!.id : undefined);
      if (!ticketTypeId) throw new ValidationError("A ticket type is required for a paid walk-in");
      return {
        kind: "paid" as const,
        checkout: await deps.registrationsService.purchase({
          eventId: event.id,
          email: input.email,
          items: [{ ticketTypeId, quantity: input.quantity ?? 1 }],
          successUrl: input.successUrl ?? `/check-in/${event.id}?walkin=1`,
          cancelUrl: input.cancelUrl ?? `/check-in/${event.id}?walkin=0`,
        }),
      };
    }
    const registration = await deps.registrationsService.register({
      eventId: event.id,
      email: input.email,
      ticketTypeId: input.ticketTypeId,
      quantity: input.quantity,
    });
    const checked = await checkIn(actor, {
      eventId: event.id,
      registrationId: registration.id,
      clientOpId: `walkin:${event.id}:${registration.id}`,
      source: "walk_in",
    });
    return { kind: "free" as const, registration, checkIn: checked };
  }

  async function counter(actor: Actor, eventId: string) {
    const event = await requireEvent(actor, eventId);
    return {
      eventId: event.id,
      checkedIn: await deps.records.countByEvent(event.id),
      capacity: event.capacity,
    };
  }

  async function listRecords(actor: Actor, eventId: string) {
    const event = await requireEvent(actor, eventId);
    return deps.records.listByEvent(event.id);
  }

  async function doorList(actor: Actor, eventId: string) {
    const snapshot = await manifest(actor, eventId);
    return {
      title: snapshot.title,
      generatedAt: snapshot.generatedAt,
      guests: snapshot.guests.map((guest) => ({
        displayName: guest.displayName,
        ticketTypeName: guest.ticketTypeName,
        ticketCode: guest.ticketCode,
        qrToken: guest.qrToken,
        quantity: guest.quantity,
        checkedInAt: guest.checkedInAt,
      })),
    };
  }

  async function revokePass(actor: Actor, registrationId: string) {
    assertPermission(actor, "checkin:manage");
    const pass = await deps.passes.findByRegistration(registrationId);
    if (!pass) throw new NotFoundError("CheckInPass", registrationId);
    assertSameTenant(pass, actor.organizationId, "CheckInPass");
    return deps.passes.save({ ...pass, revokedAt: clock.now() });
  }

  return {
    checkIn,
    bulkCheckIn,
    checkAllIn,
    sync,
    manifest,
    search,
    walkIn,
    counter,
    listRecords,
    doorList,
    revokePass,
    ensurePass,
    qrFor,
  };
}

export type CheckInService = ReturnType<typeof createCheckInService>;
