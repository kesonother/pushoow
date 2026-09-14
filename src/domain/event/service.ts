import { ConflictError, ForbiddenError, ValidationError } from "@/domain/errors";
import type { Actor, Permission } from "@/domain/rbac/permissions";
import { assertPermission, hasPermission } from "@/domain/rbac/permissions";
import { assertCanMutateRosterMode } from "@/domain/privacy/roster";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type { EventChangeNotifier } from "@/domain/calendar/notify";
import type { Calendar, CalendarRepository } from "@/domain/calendar/types";
import type { PaymentAdapter } from "@/domain/calendar/membership-types";
import { assertTransition, recordDateChange, requiresPublishPermission } from "@/domain/event/lifecycle";
import {
  expandRecurrence,
  type OccurrenceOverrideRepository,
  type RecurrenceFrequency,
  type RecurrenceRule,
  type RecurrenceRuleRepository,
} from "@/domain/event/recurrence";
import { createRegistrationService, type RegistrationNotifier } from "@/domain/event/registration-service";
import { emitIntegrationEvent } from "@/domain/integration/emit";
import type { IntegrationEmitter } from "@/domain/integration/types";
import { emitPublicWebhook } from "@/domain/public-api/service";
import type { PublicWebhookEvent } from "@/domain/public-api/types";
import { getEventTemplate } from "@/domain/event/templates";
import {
  eventDefaults,
  isPublishStatus,
  type Event,
  type EventListQuery,
  type EventRepository,
  type EventStatus,
  type EventWriteInput,
} from "@/domain/event/types";
import { validateWizardStep, type WizardStep } from "@/domain/event/wizard";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { slugFromName } from "@/lib/slug";
import { createHash } from "node:crypto";

export type EventServiceDeps = {
  events: EventRepository;
  calendars: CalendarRepository;
  notify?: EventChangeNotifier;
  registrantNotify?: RegistrationNotifier;
  payments?: PaymentAdapter;
  recurrences?: RecurrenceRuleRepository;
  overrides?: OccurrenceOverrideRepository;
  registrations?: ReturnType<typeof createRegistrationService>;
  integrations?: IntegrationEmitter;
  publicWebhooks?: { emit: (event: PublicWebhookEvent) => Promise<void> };
  clock?: Clock;
  ids?: IdGenerator;
};

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

function assertPaidPublishAllowed(
  actor: Actor,
  status: EventStatus | undefined,
  isPaid: boolean,
) {
  if (isPublishStatus(status ?? "draft") && isPaid && !actor.emailVerified) {
    throw new ForbiddenError(
      "Paid events require a verified email address before publication",
    );
  }
}

function assertWindow(startsAt: Date, endsAt: Date) {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new ValidationError("Event dates are invalid");
  }
  if (endsAt <= startsAt) {
    throw new ValidationError("Event end must be after start");
  }
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createEventService(deps: EventServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function requireCalendar(actor: Actor, calendarId: string) {
    const calendar = await deps.calendars.findById(calendarId);
    assertSameTenant(calendar, actor.organizationId, "Calendar");
    return calendar as Calendar;
  }

  async function createEvent(
    actor: Actor,
    input: EventWriteInput & { calendarId: string; title: string; startsAt: Date; endsAt: Date },
  ): Promise<Event> {
    const permission: Permission = requiresPublishPermission(input.status)
      ? "events:publish"
      : "events:create";
    assertPermission(actor, permission);
    assertPaidPublishAllowed(actor, input.status, input.isPaid ?? false);
    const calendar = await requireCalendar(actor, input.calendarId);

    const title = input.title.trim();
    const startsAt = input.startsAt;
    let endsAt = input.endsAt;
    const timezone = input.timezone ?? calendar.timezone;
    let tags = normalizeTags(input.tags);
    let locationKind = input.locationKind ?? eventDefaults().locationKind;
    let capacity = input.capacity ?? null;
    let registrationMode = input.registrationMode ?? "open_rsvp";
    let waitlistEnabled = input.waitlistEnabled ?? true;
    const template = input.templateId ? getEventTemplate(input.templateId) : null;
    if (template) {
      tags = [...new Set([...template.defaults.tags, ...tags])];
      locationKind = input.locationKind ?? template.defaults.locationKind;
      capacity = input.capacity ?? template.defaults.capacity;
      registrationMode = input.registrationMode ?? template.defaults.registrationMode;
      waitlistEnabled = input.waitlistEnabled ?? template.defaults.waitlistEnabled;
      if (!input.endsAt || input.endsAt.getTime() === input.startsAt.getTime()) {
        endsAt = new Date(startsAt.getTime() + template.defaults.durationMinutes * 60_000);
      }
    }

    if (title.length < 2) {
      throw new ValidationError("Event title is too short");
    }
    assertWindow(startsAt, endsAt);

    const slug = input.slug ? slugFromName(input.slug) : slugFromName(title);
    const existing = await deps.events.findByCalendarAndSlug(calendar.id, slug);
    if (existing && !existing.deletedAt) {
      throw new ConflictError("An event with this slug already exists", { slug });
    }
    const taken = await deps.events.findBySlug(slug);
    if (taken && !taken.deletedAt) {
      throw new ConflictError("An event with this slug already exists", { slug });
    }

    const now = clock.now();
    const created = await deps.events.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      calendarId: calendar.id,
      slug,
      title,
      description: input.description?.trim() || null,
      startsAt,
      endsAt,
      timezone,
      status: input.status ?? "draft",
      visibility: input.visibility ?? calendar.visibility,
      isPaid: input.isPaid ?? false,
      isFeatured: input.isFeatured ?? false,
      tags,
      venueName: input.venueName?.trim() || null,
      venueAddress: input.venueAddress?.trim() || null,
      ...eventDefaults(),
      city: input.city?.trim() || null,
      country: input.country?.trim() || null,
      category: input.category?.trim() || template?.id || null,
      language: input.language?.trim() || calendar.locale,
      coverImageUrl: input.coverImageUrl ?? null,
      capacity,
      organizerUserId: actor.userId,
      locationKind,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      customPinLabel: input.customPinLabel ?? null,
      virtualUrl: input.virtualUrl ?? null,
      virtualProvider: input.virtualProvider ?? null,
      templateId: template?.id ?? null,
      registrationMode,
      rosterMode: input.rosterMode ?? "hidden",
      registrationPasswordHash: input.registrationPassword
        ? hashSecret(input.registrationPassword)
        : null,
      allowedEmailDomains: (input.allowedEmailDomains ?? []).map((item) => item.toLowerCase()),
      accessToken: input.accessToken ?? null,
      waitlistEnabled,
      waitlistDuringPresale: input.waitlistDuringPresale ?? false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    if (isPublishStatus(created.status)) {
      await deps.notify?.notify({
        organizationId: created.organizationId,
        calendarId: created.calendarId,
        eventId: created.id,
        change: "published",
        title: created.title,
        calendarName: calendar.name,
      });
    }
    await emitIntegrationEvent(deps.integrations, {
      type: "event.upsert",
      organizationId: created.organizationId,
      eventId: created.id,
    });
    await emitPublicWebhook(deps.publicWebhooks, {
      type: "event.created",
      organizationId: created.organizationId,
      data: { id: created.id, calendarId: created.calendarId, status: created.status },
    });

    return created;
  }

  async function listEvents(
    actor: Actor,
    calendarId: string,
    query?: EventListQuery,
  ): Promise<Event[]> {
    assertPermission(actor, "organization:read");
    const calendar = await requireCalendar(actor, calendarId);
    const events = await deps.events.listByCalendar(calendar.id, query);
    return events.filter((event) => !event.deletedAt);
  }

  async function listEventsForOrganization(actor: Actor, query?: EventListQuery): Promise<Event[]> {
    assertPermission(actor, "organization:read");
    const list = deps.events.listByOrganization
      ? await deps.events.listByOrganization(actor.organizationId, query)
      : [];
    return list.filter((event) => !event.deletedAt);
  }

  async function getEvent(actor: Actor, eventId: string): Promise<Event> {
    assertPermission(actor, "organization:read");
    const event = await deps.events.findById(eventId);
    assertSameTenant(event, actor.organizationId, "Event");
    return event as Event;
  }

  async function updateEvent(actor: Actor, eventId: string, input: EventWriteInput): Promise<Event> {
    const permission: Permission = requiresPublishPermission(input.status)
      ? "events:publish"
      : "events:update";
    assertPermission(actor, permission);
    if (input.rosterMode) {
      assertCanMutateRosterMode(hasPermission(actor.role, "events:update"));
    }
    const event = await getEvent(actor, eventId);
    if (input.status && input.status !== event.status) {
      assertTransition(event.status, input.status);
    }
    assertPaidPublishAllowed(
      actor,
      input.status ?? event.status,
      input.isPaid ?? event.isPaid,
    );
    const startsAt = input.startsAt ?? event.startsAt;
    const endsAt = input.endsAt ?? event.endsAt;
    assertWindow(startsAt, endsAt);

    const nextSlug = input.slug ? slugFromName(input.slug) : event.slug;
    if (nextSlug !== event.slug) {
      const existing = await deps.events.findByCalendarAndSlug(event.calendarId, nextSlug);
      if (existing && existing.id !== event.id && !existing.deletedAt) {
        throw new ConflictError("An event with this slug already exists", { slug: nextSlug });
      }
      const global = await deps.events.findBySlug(nextSlug);
      if (global && global.id !== event.id && !global.deletedAt) {
        throw new ConflictError("An event with this slug already exists", { slug: nextSlug });
      }
    }

    const updated = await deps.events.update({
      ...event,
      title: input.title?.trim() ?? event.title,
      slug: nextSlug,
      description:
        input.description === undefined ? event.description : input.description?.trim() || null,
      startsAt,
      endsAt,
      timezone: input.timezone ?? event.timezone,
      status: input.status ?? event.status,
      visibility: input.visibility ?? event.visibility,
      isPaid: input.isPaid ?? event.isPaid,
      isFeatured: input.isFeatured ?? event.isFeatured,
      tags: input.tags ? normalizeTags(input.tags) : event.tags,
      city: input.city === undefined ? event.city : input.city?.trim() || null,
      country: input.country === undefined ? event.country : input.country?.trim() || null,
      category: input.category === undefined ? event.category : input.category?.trim() || null,
      language: input.language === undefined ? event.language : input.language?.trim() || null,
      venueName: input.venueName === undefined ? event.venueName : input.venueName?.trim() || null,
      venueAddress:
        input.venueAddress === undefined ? event.venueAddress : input.venueAddress?.trim() || null,
      coverImageUrl:
        input.coverImageUrl === undefined ? event.coverImageUrl : input.coverImageUrl,
      capacity: input.capacity === undefined ? event.capacity : input.capacity,
      locationKind: input.locationKind ?? event.locationKind,
      latitude: input.latitude === undefined ? event.latitude : input.latitude,
      longitude: input.longitude === undefined ? event.longitude : input.longitude,
      customPinLabel:
        input.customPinLabel === undefined ? event.customPinLabel : input.customPinLabel,
      virtualUrl: input.virtualUrl === undefined ? event.virtualUrl : input.virtualUrl,
      virtualProvider:
        input.virtualProvider === undefined ? event.virtualProvider : input.virtualProvider,
      templateId: input.templateId === undefined ? event.templateId : input.templateId,
      registrationMode: input.registrationMode ?? event.registrationMode,
      rosterMode: input.rosterMode ?? event.rosterMode,
      registrationPasswordHash: input.registrationPassword
        ? hashSecret(input.registrationPassword)
        : event.registrationPasswordHash,
      allowedEmailDomains: input.allowedEmailDomains
        ? input.allowedEmailDomains.map((item) => item.toLowerCase())
        : event.allowedEmailDomains,
      accessToken: input.accessToken === undefined ? event.accessToken : input.accessToken,
      waitlistEnabled: input.waitlistEnabled ?? event.waitlistEnabled,
      waitlistDuringPresale: input.waitlistDuringPresale ?? event.waitlistDuringPresale,
      dateHistory: recordDateChange(event, startsAt, endsAt, clock.now()),
      updatedAt: clock.now(),
    });

    const nextStatus = updated.status;
    if (nextStatus === "cancelled" && event.status !== "cancelled") {
      await deps.notify?.notify({
        organizationId: updated.organizationId,
        calendarId: updated.calendarId,
        eventId: updated.id,
        change: "cancelled",
        title: updated.title,
        calendarName: (await requireCalendar(actor, updated.calendarId)).name,
      });
      await emitIntegrationEvent(deps.integrations, {
        type: "event.cancelled",
        organizationId: updated.organizationId,
        eventId: updated.id,
      });
      await emitPublicWebhook(deps.publicWebhooks, {
        type: "event.cancelled",
        organizationId: updated.organizationId,
        data: { id: updated.id, calendarId: updated.calendarId, status: updated.status },
      });
    } else if (isPublishStatus(nextStatus)) {
      const change = isPublishStatus(event.status) ? "updated" : "published";
      await deps.notify?.notify({
        organizationId: updated.organizationId,
        calendarId: updated.calendarId,
        eventId: updated.id,
        change,
        title: updated.title,
        calendarName: (await requireCalendar(actor, updated.calendarId)).name,
      });
      await emitIntegrationEvent(deps.integrations, {
        type: "event.upsert",
        organizationId: updated.organizationId,
        eventId: updated.id,
      });
    }
    if (nextStatus !== "cancelled" || event.status === "cancelled") {
      await emitPublicWebhook(deps.publicWebhooks, {
        type: "event.updated",
        organizationId: updated.organizationId,
        data: { id: updated.id, calendarId: updated.calendarId, status: updated.status },
      });
    }

    return updated;
  }

  async function saveWizardStep(
    actor: Actor,
    input: EventWriteInput & { calendarId?: string; title?: string; startsAt?: Date; endsAt?: Date },
    step: WizardStep,
    eventId?: string,
  ): Promise<Event> {
    const current = eventId ? await getEvent(actor, eventId) : null;
    validateWizardStep(step, {
      title: current?.title,
      startsAt: current?.startsAt,
      endsAt: current?.endsAt,
      venueName: current?.venueName,
      venueAddress: current?.venueAddress,
      virtualUrl: current?.virtualUrl,
      locationKind: current?.locationKind,
      registrationMode: current?.registrationMode,
      capacity: current?.capacity,
      registrationPassword: current?.registrationPasswordHash ? "set" : undefined,
      allowedEmailDomains: current?.allowedEmailDomains,
      accessToken: current?.accessToken,
      ...input,
    });
    if (eventId) {
      return updateEvent(actor, eventId, input);
    }
    if (!input.title || !input.startsAt || !input.endsAt || !input.calendarId) {
      throw new ValidationError("Basics are required before saving a draft");
    }
    return createEvent(actor, {
      ...input,
      calendarId: input.calendarId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "draft",
    });
  }

  async function cancelEvent(actor: Actor, eventId: string): Promise<Event> {
    assertPermission(actor, "events:update");
    const event = await getEvent(actor, eventId);
    assertTransition(event.status, "cancelled");
    const updated = await updateEvent(actor, eventId, { status: "cancelled" });
    await deps.registrations?.notifyRegistrants(updated, "cancelled");
    if (updated.isPaid) {
      await deps.registrations?.refundPaidOrders(updated);
    }
    return updated;
  }

  async function postponeEvent(
    actor: Actor,
    eventId: string,
    next: { startsAt: Date; endsAt: Date },
  ): Promise<Event> {
    assertPermission(actor, "events:update");
    const event = await getEvent(actor, eventId);
    assertTransition(event.status, "postponed");
    assertWindow(next.startsAt, next.endsAt);
    const updated = await deps.events.update({
      ...event,
      startsAt: next.startsAt,
      endsAt: next.endsAt,
      status: "postponed",
      postponedFromStartsAt: event.startsAt,
      postponedFromEndsAt: event.endsAt,
      dateHistory: recordDateChange(event, next.startsAt, next.endsAt, clock.now()),
      updatedAt: clock.now(),
    });
    await deps.notify?.notify({
      organizationId: updated.organizationId,
      calendarId: updated.calendarId,
      eventId: updated.id,
      change: "updated",
      title: updated.title,
      calendarName: (await requireCalendar(actor, updated.calendarId)).name,
    });
    await deps.registrations?.notifyRegistrants(
      updated,
      "postponed",
      `New start: ${updated.startsAt.toISOString()}.`,
    );
    return updated;
  }

  async function setRecurrence(
    actor: Actor,
    eventId: string,
    input: {
      frequency: RecurrenceFrequency;
      interval?: number;
      weekdays?: number[];
      until?: Date | null;
      count?: number | null;
      exceptions?: string[];
    },
  ): Promise<RecurrenceRule> {
    assertPermission(actor, "events:update");
    const event = await getEvent(actor, eventId);
    if (!deps.recurrences) {
      throw new ValidationError("Recurrence storage is not available");
    }
    const now = clock.now();
    return deps.recurrences.save({
      id: ids.id(),
      organizationId: event.organizationId,
      eventId: event.id,
      frequency: input.frequency,
      interval: input.interval ?? 1,
      weekdays: input.weekdays ?? [],
      until: input.until ?? null,
      count: input.count ?? null,
      exceptions: input.exceptions ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  async function overrideOccurrence(
    actor: Actor,
    eventId: string,
    originalStartsAt: Date,
    patch: { startsAt?: Date; endsAt?: Date; cancelled?: boolean },
  ) {
    assertPermission(actor, "events:update");
    const event = await getEvent(actor, eventId);
    if (!deps.overrides) throw new ValidationError("Occurrence overrides are not available");
    const now = clock.now();
    const existing = await deps.overrides.findByEventAndOriginal(event.id, originalStartsAt);
    return deps.overrides.save({
      id: existing?.id ?? ids.id(),
      organizationId: event.organizationId,
      eventId: event.id,
      originalStartsAt,
      startsAt: patch.startsAt ?? existing?.startsAt ?? null,
      endsAt: patch.endsAt ?? existing?.endsAt ?? null,
      cancelled: patch.cancelled ?? existing?.cancelled ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async function listOccurrences(eventId: string) {
    const event = await deps.events.findById(eventId);
    if (!event || event.deletedAt) return [];
    const rule = deps.recurrences ? await deps.recurrences.findByEvent(eventId) : null;
    if (!rule) {
      return [
        {
          originalStartsAt: event.startsAt,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          cancelled: event.status === "cancelled",
          overridden: false,
        },
      ];
    }
    const overrides = deps.overrides ? await deps.overrides.listByEvent(eventId) : [];
    return expandRecurrence({
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      rule,
      overrides,
    });
  }

  return {
    createEvent,
    listEvents,
    listEventsForOrganization,
    getEvent,
    updateEvent,
    saveWizardStep,
    cancelEvent,
    postponeEvent,
    setRecurrence,
    overrideOccurrence,
    listOccurrences,
  };
}
