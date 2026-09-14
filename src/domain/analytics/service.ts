import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import {
  buildAdvancedAnalytics,
  buildEventDashboard,
  buildOrganizerDashboard,
  rowsFromEvent,
  rowsFromOrganizer,
  utcDay,
} from "@/domain/analytics/compute";
import { serializeExport } from "@/domain/analytics/export";
import { hashVisitor } from "@/domain/analytics/memory";
import type {
  AdvancedAnalytics,
  AnalyticsPlan,
  AnalyticsPlanRepository,
  AnalyticsSnapshot,
  AttendeeHome,
  AttributionRepository,
  EventDashboard,
  ExportFormat,
  ExportKind,
  OrganizerDashboard,
  PageViewRepository,
  SnapshotRepository,
} from "@/domain/analytics/types";
import { SNAPSHOT_TTL_MS } from "@/domain/analytics/types";
import type { CalendarFollowerRepository } from "@/domain/calendar/follow-types";
import type { CalendarRepository } from "@/domain/calendar/types";
import type { CheckInPassRepository, CheckInRecordRepository } from "@/domain/checkin/types";
import { signCheckInQr } from "@/domain/checkin/qr";
import type { EventOrder, EventRegistrationRepository, OrderRepository } from "@/domain/event/commerce-types";
import type { Event, EventRepository } from "@/domain/event/types";
import type { NotificationDelivery, NotificationDeliveryRepository } from "@/domain/notification/types";
import type {
  CheckoutPaymentRepository,
  IssuedTicketRepository,
  PaymentRefundRepository,
} from "@/domain/payments/types";
import { canAccessFullDashboard } from "@/domain/rbac/dashboard";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission, hasPermission } from "@/domain/rbac/permissions";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type { EntitlementResolver } from "@/domain/billing/entitlements";
import { analyticsPlanFromEntitlements } from "@/domain/billing/catalog";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export function createAnalyticsService(deps: {
  events: EventRepository;
  calendars: CalendarRepository;
  registrations: EventRegistrationRepository;
  orders: OrderRepository;
  followers: CalendarFollowerRepository;
  payments: CheckoutPaymentRepository;
  refunds: PaymentRefundRepository;
  issuedTickets?: IssuedTicketRepository;
  records: CheckInRecordRepository;
  passes?: CheckInPassRepository;
  deliveries?: NotificationDeliveryRepository & { listAll?: () => Promise<NotificationDelivery[]> };
  attributions: AttributionRepository;
  pageViews: PageViewRepository;
  snapshots: SnapshotRepository;
  plans: AnalyticsPlanRepository;
  entitlements?: EntitlementResolver;
  secret: string;
  enqueueRefresh?: (input: { organizationId?: string; eventId?: string }) => Promise<void>;
  clock?: Clock;
  ids?: IdGenerator;
}) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const cache = new Map<string, { at: number; payload: unknown }>();

  function cacheKey(scope: string, id: string) {
    return `${scope}:${id}`;
  }

  function readCache<T>(key: string): T | null {
    const hit = cache.get(key);
    if (!hit) return null;
    if (clock.now().getTime() - hit.at > SNAPSHOT_TTL_MS) return null;
    return hit.payload as T;
  }

  function writeCache(key: string, payload: unknown) {
    cache.set(key, { at: clock.now().getTime(), payload });
  }

  async function planFor(organizationId: string): Promise<AnalyticsPlan> {
    if (deps.entitlements) {
      const entitlements = await deps.entitlements.forOrganization(organizationId);
      return analyticsPlanFromEntitlements(entitlements.planId, entitlements);
    }
    return (await deps.plans.find(organizationId))?.plan ?? "free";
  }

  async function eventsForOrg(organizationId: string): Promise<Event[]> {
    if (deps.events.listByOrganization) {
      return (await deps.events.listByOrganization(organizationId)).filter((event) => !event.deletedAt);
    }
    return [];
  }

  async function registrationsForOrg(organizationId: string, events: Event[]) {
    if (deps.registrations.listByOrganization) {
      return deps.registrations.listByOrganization(organizationId);
    }
    if (deps.registrations.listAll) {
      return (await deps.registrations.listAll()).filter((item) => item.organizationId === organizationId);
    }
    const nested = await Promise.all(events.map((event) => deps.registrations.listByEvent(event.id)));
    return nested.flat();
  }

  async function ordersForOrg(organizationId: string, events: Event[]): Promise<EventOrder[]> {
    if (deps.orders.listByOrganization) {
      return deps.orders.listByOrganization(organizationId);
    }
    const nested = await Promise.all(events.map((event) => deps.orders.listByEvent(event.id)));
    return nested.flat();
  }

  async function followersForOrg(events: Event[]) {
    const calendarIds = [...new Set(events.map((event) => event.calendarId))];
    const counts = await Promise.all(calendarIds.map((calendarId) => deps.followers.countByCalendar(calendarId)));
    return counts.reduce((sum, count) => sum + count, 0);
  }

  async function attendanceMap(events: Event[]) {
    const map = new Map<string, number>();
    for (const event of events) {
      map.set(event.id, await deps.records.countByEvent(event.id));
    }
    return map;
  }

  async function deliveriesAll() {
    return deps.deliveries?.listAll ? deps.deliveries.listAll() : [];
  }

  async function persistSnapshot(
    organizationId: string,
    scope: "organization" | "event",
    scopeId: string,
    payload: unknown,
  ) {
    const snapshot: AnalyticsSnapshot = {
      id: ids.id(),
      organizationId,
      scope,
      scopeId,
      payload,
      computedAt: clock.now(),
    };
    await deps.snapshots.save(snapshot);
    writeCache(cacheKey(scope, scopeId), payload);
    return snapshot;
  }

  async function loadSnapshot<T extends { stale: boolean; computedAt: string }>(
    organizationId: string,
    scope: "organization" | "event",
    scopeId: string,
    compute: () => Promise<T>,
    enqueue?: () => Promise<void>,
  ): Promise<T> {
    const cached = readCache<T>(cacheKey(scope, scopeId));
    if (cached) return { ...cached, stale: false };
    const stored = await deps.snapshots.find(scope, scopeId);
    if (stored) {
      const age = clock.now().getTime() - stored.computedAt.getTime();
      const payload = stored.payload as T;
      if (age <= SNAPSHOT_TTL_MS) {
        writeCache(cacheKey(scope, scopeId), payload);
        return { ...payload, stale: false };
      }
      if (enqueue) await enqueue();
      return { ...payload, stale: true };
    }
    const fresh = await compute();
    await persistSnapshot(organizationId, scope, scopeId, fresh);
    return fresh;
  }

  async function computeOrganizer(actor: Actor): Promise<OrganizerDashboard> {
    const events = await eventsForOrg(actor.organizationId);
    const [registrations, orders, followers, payments, refunds, attendanceByEvent] = await Promise.all([
      registrationsForOrg(actor.organizationId, events),
      ordersForOrg(actor.organizationId, events),
      followersForOrg(events),
      deps.payments.listByOrganization(actor.organizationId),
      deps.refunds.listByOrganization(actor.organizationId),
      attendanceMap(events),
    ]);
    return buildOrganizerDashboard({
      organizationId: actor.organizationId,
      now: clock.now(),
      events,
      registrations,
      followers,
      payments,
      refunds,
      orders,
      attendanceByEvent,
      includeRevenue: hasPermission(actor.role, "finance:read"),
    });
  }

  async function computeEvent(actor: Actor, event: Event): Promise<EventDashboard> {
    const [registrations, attributions, records, views, orders, refunds, deliveries] = await Promise.all([
      deps.registrations.listByEvent(event.id),
      deps.attributions.listByEvent(event.id),
      deps.records.listByEvent(event.id),
      deps.pageViews.listByEvent(event.id),
      deps.orders.listByEvent(event.id),
      deps.refunds.listByOrganization(actor.organizationId),
      deliveriesAll(),
    ]);
    const orderIds = new Set(orders.map((order) => order.id));
    const walkIns = new Set(records.filter((item) => item.source === "walk_in").map((item) => item.registrationId));
    return buildEventDashboard({
      event,
      now: clock.now(),
      registrations,
      attributions,
      walkIns,
      pageViews: views,
      checkedIn: records.length,
      deliveries,
      refunds: refunds.filter((item) => orderIds.has(item.orderId)),
      orders,
      includeFinance: hasPermission(actor.role, "finance:read"),
    });
  }

  async function organizerDashboard(actor: Actor): Promise<OrganizerDashboard> {
    assertPermission(actor, "organization:read");
    if (!canAccessFullDashboard(actor.role)) {
      throw new ForbiddenError("Check-in managers cannot access the organizer dashboard");
    }
    return loadSnapshot(
      actor.organizationId,
      "organization",
      actor.organizationId,
      () => computeOrganizer(actor),
      async () => {
        await deps.enqueueRefresh?.({ organizationId: actor.organizationId });
      },
    );
  }

  async function eventDashboard(actor: Actor, eventId: string): Promise<EventDashboard> {
    assertPermission(actor, "registrants:read");
    const event = await deps.events.findById(eventId);
    assertSameTenant(event, actor.organizationId, "Event");
    return loadSnapshot(
      actor.organizationId,
      "event",
      eventId,
      () => computeEvent(actor, event as Event),
      async () => {
        await deps.enqueueRefresh?.({ eventId });
      },
    );
  }

  async function refreshOrganization(organizationId: string, actor: Actor) {
    const dashboard = await computeOrganizer(actor);
    await persistSnapshot(organizationId, "organization", organizationId, dashboard);
    return dashboard;
  }

  async function refreshEvent(eventId: string, actor: Actor) {
    const event = await deps.events.findById(eventId);
    assertSameTenant(event, actor.organizationId, "Event");
    const dashboard = await computeEvent(actor, event as Event);
    await persistSnapshot(actor.organizationId, "event", eventId, dashboard);
    return dashboard;
  }

  async function advanced(actor: Actor): Promise<AdvancedAnalytics> {
    assertPermission(actor, "organization:read");
    if (!canAccessFullDashboard(actor.role)) {
      throw new ForbiddenError("Check-in managers cannot access advanced analytics");
    }
    const plan = await planFor(actor.organizationId);
    const entitlements = deps.entitlements
      ? await deps.entitlements.forOrganization(actor.organizationId)
      : null;
    const events = await eventsForOrg(actor.organizationId);
    const [registrations, attributions, views, attendanceByEvent, payments, orders, deliveries] = await Promise.all([
      registrationsForOrg(actor.organizationId, events),
      deps.attributions.listByOrganization(actor.organizationId),
      deps.pageViews.listByOrganization(actor.organizationId),
      attendanceMap(events),
      deps.payments.listByOrganization(actor.organizationId),
      ordersForOrg(actor.organizationId, events),
      deliveriesAll(),
    ]);
    return buildAdvancedAnalytics({
      plan,
      available: entitlements ? entitlements.advancedAnalytics : undefined,
      events,
      registrations,
      attributions,
      views,
      attendanceByEvent,
      payments: hasPermission(actor.role, "finance:read") ? payments : [],
      orders,
      deliveries,
    });
  }

  async function recordView(eventId: string, visitorId: string) {
    const event = await deps.events.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    return deps.pageViews.increment({
      organizationId: event.organizationId,
      eventId: event.id,
      day: utcDay(clock.now()),
      visitorHash: hashVisitor(visitorId),
    });
  }

  async function attendeeHome(userId: string, email?: string | null): Promise<AttendeeHome> {
    if (!userId) throw new ForbiddenError("Sign in to view your events");
    const registrations = deps.registrations.listByUser ? await deps.registrations.listByUser(userId) : [];
    const extra =
      email && deps.registrations.listAll
        ? (await deps.registrations.listAll()).filter((item) => item.email === email && item.userId !== userId)
        : [];
    const mine = [...registrations, ...extra];
    const events: AttendeeHome["events"] = [];
    const tickets: AttendeeHome["tickets"] = [];
    for (const registration of mine) {
      const event = await deps.events.findById(registration.eventId);
      if (!event || event.deletedAt) continue;
      events.push({
        registrationId: registration.id,
        eventId: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt.toISOString(),
        status: registration.status,
      });
      const issued = deps.issuedTickets?.listByRegistration
        ? await deps.issuedTickets.listByRegistration(registration.id)
        : [];
      let qrToken: string | null = null;
      if (deps.passes) {
        const existing = await deps.passes.findByRegistration(registration.id);
        const pass =
          existing ??
          (await deps.passes.create({
            id: ids.id(),
            organizationId: event.organizationId,
            eventId: event.id,
            registrationId: registration.id,
            issuedTicketId: issued[0]?.id ?? null,
            revokedAt: null,
            expiresAt: new Date(event.endsAt.getTime() + 86_400_000),
            createdAt: clock.now(),
          }));
        if (!pass.revokedAt) {
          qrToken = signCheckInQr(
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
      }
      tickets.push({
        registrationId: registration.id,
        eventId: event.id,
        title: event.title,
        startsAt: event.startsAt.toISOString(),
        status: registration.status,
        ticketCode: issued[0]?.code ?? null,
        qrToken,
      });
    }
    const follows = deps.followers.listByUser ? await deps.followers.listByUser(userId) : [];
    const calendars: AttendeeHome["calendars"] = [];
    for (const follow of follows) {
      const calendar = await deps.calendars.findById(follow.calendarId);
      if (!calendar || calendar.deletedAt) continue;
      calendars.push({ calendarId: calendar.id, name: calendar.name, slug: calendar.slug });
    }
    events.sort((left, right) => right.startsAt.localeCompare(left.startsAt));
    return { events, calendars, tickets };
  }

  async function attendeeTicket(userId: string, registrationId: string) {
    const home = await attendeeHome(userId);
    const ticket = home.tickets.find((item) => item.registrationId === registrationId);
    if (!ticket) throw new NotFoundError("Ticket", registrationId);
    return ticket;
  }

  async function exportDashboard(
    actor: Actor | { userId: string; organizationId?: string; role?: Actor["role"] },
    input: { kind: ExportKind; format: ExportFormat; eventId?: string },
  ) {
    if (input.kind === "attendee") {
      if (!("userId" in actor) || !actor.userId) throw new ForbiddenError("Sign in to export your tickets");
      const home = await attendeeHome(actor.userId);
      return serializeExport(input.format, home.tickets);
    }
    const staff = actor as Actor;
    assertPermission(staff.role, "exports:create");
    if (input.kind === "organizer") {
      return serializeExport(input.format, rowsFromOrganizer(await organizerDashboard(staff)));
    }
    if (!input.eventId) throw new ValidationError("An event id is required");
    const dashboard = await eventDashboard(staff, input.eventId);
    if (input.kind === "registrants" && !hasPermission(staff.role, "registrants:read")) {
      throw new ForbiddenError("Role cannot export registrants");
    }
    return serializeExport(input.format, input.kind === "event" ? [dashboard] : rowsFromEvent(dashboard));
  }

  return {
    organizerDashboard,
    eventDashboard,
    advanced,
    refreshOrganization,
    refreshEvent,
    recordView,
    attendeeHome,
    attendeeTicket,
    exportDashboard,
    planFor,
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
