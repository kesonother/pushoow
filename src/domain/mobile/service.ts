import type { AttendeeHome } from "@/domain/analytics/types";
import type { CalendarRepository } from "@/domain/calendar/types";
import { NotFoundError, ValidationError } from "@/domain/errors";
import type { EventRepository } from "@/domain/event/types";
import { sealSensitiveCache } from "@/domain/mobile/crypto";
import { appPathFor, APP_DEEP_LINK_TEMPLATES, parseDeepLink, WEB_DEEP_LINK_TEMPLATES, webPathFor } from "@/domain/mobile/links";
import {
  MOBILE_FEATURES,
  MOBILE_PLATFORMS,
  MOBILE_PUSH_CATEGORIES,
  MOBILE_PUSH_PROVIDERS,
  SENSITIVE_CACHE_FIELDS,
  WATCH_ARCHITECTURE_STATUS,
  WATCH_TRANSPORTS,
  type CachedTicket,
  type CachedUpcomingEvent,
  type MobileBootstrap,
  type MobileDevice,
  type MobileDeviceRepository,
  type MobilePlatform,
  type MobilePushCategory,
  type MobilePushPort,
  type MobilePushProvider,
  type OfflineCachePayload,
  type ResolvedDeepLink,
} from "@/domain/mobile/types";
import { assertWatchServerSyncNotShipped, prepareWatchCompanion } from "@/domain/mobile/watch";
import { widgetSnapshotFromUpcoming } from "@/domain/mobile/widget";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export type MobileHomePort = {
  attendeeHome: (userId: string, email?: string | null) => Promise<AttendeeHome>;
};

export type MobileServiceDeps = {
  devices: MobileDeviceRepository;
  home: MobileHomePort;
  events: Pick<EventRepository, "findBySlug" | "findById">;
  calendars: Pick<CalendarRepository, "findBySlug">;
  push?: Partial<Record<MobilePushProvider, MobilePushPort>>;
  clock?: Clock;
  ids?: IdGenerator;
};

function isPlatform(value: string): value is MobilePlatform {
  return (MOBILE_PLATFORMS as readonly string[]).includes(value);
}

function isProvider(value: string): value is MobilePushProvider {
  return (MOBILE_PUSH_PROVIDERS as readonly string[]).includes(value);
}

function isCategory(value: string): value is MobilePushCategory {
  return (MOBILE_PUSH_CATEGORIES as readonly string[]).includes(value);
}

function providerFor(platform: MobilePlatform): MobilePushProvider {
  return platform === "ios" ? "apns" : "fcm";
}

export function createMobileService(deps: MobileServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  function pushConfigured(): Record<MobilePushProvider, boolean> {
    return {
      apns: Boolean(deps.push?.apns?.isConfigured()),
      fcm: Boolean(deps.push?.fcm?.isConfigured()),
    };
  }

  function bootstrap(): MobileBootstrap {
    return {
      platforms: MOBILE_PLATFORMS,
      features: MOBILE_FEATURES,
      endpoints: {
        discover: "/api/v1/discover",
        map: "/api/v1/discover/map",
        snapshot: "/api/v1/me/mobile/snapshot",
        devices: "/api/v1/me/mobile/devices",
        widget: "/api/v1/me/mobile/widget",
        links: "/api/v1/mobile/links",
        notifications: "/api/v1/me/notifications",
      },
      offline: {
        encryptedFields: SENSITIVE_CACHE_FIELDS,
        algorithm: "aes-256-gcm",
        caches: ["upcoming_events", "tickets", "qr_codes"],
      },
      push: {
        providers: MOBILE_PUSH_PROVIDERS,
        categories: MOBILE_PUSH_CATEGORIES,
        configured: pushConfigured(),
      },
      deepLinks: {
        scheme: "pushoow",
        webTemplates: WEB_DEEP_LINK_TEMPLATES,
        appTemplates: APP_DEEP_LINK_TEMPLATES,
      },
      widget: {
        kinds: ["next_event", "countdown"],
        refresh: "pull",
        writeBack: false,
      },
      watch: {
        appleWatch: true,
        wearOs: true,
        bidirectionalSync: false,
        serverChannel: false,
        status: WATCH_ARCHITECTURE_STATUS,
        transports: WATCH_TRANSPORTS,
      },
    };
  }

  async function cacheFor(userId: string, email?: string | null): Promise<OfflineCachePayload> {
    const home = await deps.home.attendeeHome(userId, email);
    const now = clock.now().getTime();
    const upcomingEvents: CachedUpcomingEvent[] = home.events
      .filter((item) => new Date(item.startsAt).getTime() >= now)
      .map((item) => ({
        eventId: item.eventId,
        registrationId: item.registrationId,
        slug: item.slug,
        title: item.title,
        startsAt: item.startsAt,
        status: item.status,
      }))
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    const tickets: CachedTicket[] = home.tickets.map((item) => ({
      registrationId: item.registrationId,
      eventId: item.eventId,
      title: item.title,
      startsAt: item.startsAt,
      status: item.status,
      ticketCode: item.ticketCode,
      qrToken: item.qrToken,
    }));
    return {
      upcomingEvents,
      tickets,
      qrCodes: tickets
        .filter((item) => Boolean(item.qrToken))
        .map((item) => ({ registrationId: item.registrationId, eventId: item.eventId, token: item.qrToken! })),
      calendars: home.calendars,
    };
  }

  async function snapshot(
    userId: string,
    input?: { email?: string | null; deviceUnlockKey?: string; platform?: MobilePlatform; deviceId?: string },
  ) {
    const cache = await cacheFor(userId, input?.email);
    if (input?.deviceId) {
      const device = await deps.devices.findById(input.deviceId);
      if (device && device.userId === userId && !device.revokedAt) {
        await deps.devices.save({ ...device, lastSnapshotAt: clock.now(), updatedAt: clock.now() });
      }
    }
    const widget = widgetSnapshotFromUpcoming(cache.upcomingEvents, clock.now());
    const sensitive = { tickets: cache.tickets, qrCodes: cache.qrCodes };
    const sealed = input?.deviceUnlockKey ? sealSensitiveCache(sensitive, input.deviceUnlockKey) : null;
    const platform = input?.platform ?? "ios";
    const qr = cache.qrCodes[0]
      ? { registrationId: cache.qrCodes[0].registrationId, token: cache.qrCodes[0].token }
      : null;
    return {
      generatedAt: clock.now().toISOString(),
      features: MOBILE_FEATURES,
      cache: {
        upcomingEvents: cache.upcomingEvents,
        calendars: cache.calendars,
        tickets: sealed ? cache.tickets.map((item) => ({ ...item, ticketCode: null, qrToken: null })) : cache.tickets,
        qrCodes: sealed ? [] : cache.qrCodes,
      },
      sealed,
      encryptAtRest: [...SENSITIVE_CACHE_FIELDS],
      widget,
      watch: prepareWatchCompanion({
        platform,
        now: clock.now(),
        nextEvent: widget.nextEvent,
        qr: sealed ? null : qr,
      }),
    };
  }

  async function widget(userId: string, email?: string | null) {
    const cache = await cacheFor(userId, email);
    return widgetSnapshotFromUpcoming(cache.upcomingEvents, clock.now());
  }

  async function registerDevice(
    userId: string,
    input: {
      platform: string;
      token: string;
      pushProvider?: string;
      appBundleId?: string | null;
      widgetInstalled?: boolean;
      watchPaired?: boolean;
    },
  ): Promise<MobileDevice> {
    if (!isPlatform(input.platform)) throw new ValidationError("Invalid mobile platform");
    const pushProvider = input.pushProvider ?? providerFor(input.platform);
    if (!isProvider(pushProvider)) throw new ValidationError("Invalid push provider");
    if (providerFor(input.platform) !== pushProvider) {
      throw new ValidationError("Push provider does not match platform");
    }
    const token = input.token.trim();
    if (token.length < 16) throw new ValidationError("Push token is too short");

    const now = clock.now();
    const existing = await deps.devices.findByToken(token);
    if (existing) {
      const next: MobileDevice = {
        ...existing,
        userId,
        platform: input.platform,
        pushProvider,
        appBundleId: input.appBundleId ?? existing.appBundleId,
        widgetInstalled: input.widgetInstalled ?? existing.widgetInstalled,
        watchPaired: input.watchPaired ?? existing.watchPaired,
        revokedAt: null,
        updatedAt: now,
      };
      return deps.devices.save(next);
    }
    return deps.devices.create({
      id: ids.id(),
      userId,
      platform: input.platform,
      pushProvider,
      token,
      appBundleId: input.appBundleId ?? null,
      widgetInstalled: input.widgetInstalled ?? false,
      watchPaired: input.watchPaired ?? false,
      lastSnapshotAt: null,
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
    });
  }

  async function listDevices(userId: string): Promise<MobileDevice[]> {
    return deps.devices.listByUser(userId);
  }

  async function revokeDevice(userId: string, deviceId: string): Promise<MobileDevice> {
    const device = await deps.devices.findById(deviceId);
    if (!device || device.userId !== userId) throw new NotFoundError("MobileDevice", deviceId);
    const now = clock.now();
    return deps.devices.save({ ...device, revokedAt: now, updatedAt: now });
  }

  async function resolveLink(raw: string, userId?: string | null): Promise<ResolvedDeepLink> {
    const parsed = parseDeepLink(raw);
    if (parsed.kind === "unknown" || !parsed.slugOrId) {
      throw new ValidationError("Unsupported mobile deep link");
    }
    if (parsed.kind === "event") {
      const event = await deps.events.findBySlug(parsed.slugOrId);
      if (!event || event.deletedAt) throw new NotFoundError("Event", parsed.slugOrId);
      return {
        kind: "event",
        url: parsed.url,
        webPath: webPathFor("event", event.slug),
        appPath: appPathFor("event", event.slug),
        eventId: event.id,
        slug: event.slug,
        title: event.title,
      };
    }
    if (parsed.kind === "calendar") {
      const calendar = await deps.calendars.findBySlug(parsed.slugOrId);
      if (!calendar || calendar.deletedAt) throw new NotFoundError("Calendar", parsed.slugOrId);
      return {
        kind: "calendar",
        url: parsed.url,
        webPath: webPathFor("calendar", calendar.slug),
        appPath: appPathFor("calendar", calendar.slug),
        calendarId: calendar.id,
        slug: calendar.slug,
        title: calendar.name,
      };
    }
    if (!userId) throw new ValidationError("Ticket deep links require authentication");
    const home = await deps.home.attendeeHome(userId);
    const ticket = home.tickets.find((item) => item.registrationId === parsed.slugOrId);
    if (!ticket) throw new NotFoundError("Ticket", parsed.slugOrId);
    return {
      kind: "ticket",
      url: parsed.url,
      webPath: webPathFor("ticket", ticket.registrationId),
      appPath: appPathFor("ticket", ticket.registrationId),
      eventId: ticket.eventId,
      registrationId: ticket.registrationId,
      title: ticket.title,
    };
  }

  async function notify(
    userId: string,
    input: { category: string; title: string; body: string; deepLink?: string },
  ): Promise<{ attempted: number; delivered: number; skipped: number }> {
    if (!isCategory(input.category)) throw new ValidationError("Invalid mobile push category");
    const devices = await deps.devices.listByUser(userId);
    let delivered = 0;
    let skipped = 0;
    for (const device of devices) {
      const port = deps.push?.[device.pushProvider];
      if (!port?.isConfigured()) {
        skipped += 1;
        continue;
      }
      await port.send({
        token: device.token,
        category: input.category,
        title: input.title,
        body: input.body,
        deepLink: input.deepLink,
      });
      delivered += 1;
    }
    return { attempted: devices.length, delivered, skipped };
  }

  function requestWatchSync(): never {
    return assertWatchServerSyncNotShipped();
  }

  return {
    bootstrap,
    snapshot,
    widget,
    registerDevice,
    listDevices,
    revokeDevice,
    resolveLink,
    notify,
    requestWatchSync,
  };
}
