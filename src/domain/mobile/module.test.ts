import { describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/domain/errors";
import { sealedContainsPlaintext, unsealSensitiveCache } from "@/domain/mobile/crypto";
import { parseDeepLink } from "@/domain/mobile/links";
import { createMemoryMobileDevices } from "@/domain/mobile/memory";
import { mustEncryptAtRest, NATIVE_SCREENS, NATIVE_WATCH_TARGETS, NATIVE_WIDGET_PROVIDERS, screensFor } from "@/domain/mobile/native";
import { createMobileService } from "@/domain/mobile/service";
import {
  MOBILE_FEATURES,
  MOBILE_PUSH_CATEGORIES,
  WATCH_BIDIRECTIONAL_SYNC,
  type CachedTicket,
} from "@/domain/mobile/types";
import { WATCH_SYNC_POLICY } from "@/domain/mobile/watch";
import { createMemoryCalendars, createMemoryEvents } from "@/test/fakes";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import type { Actor } from "@/domain/rbac/permissions";

function mutableClock(iso: string) {
  let current = new Date(iso);
  return {
    now: () => new Date(current.getTime()),
    set(next: string) {
      current = new Date(next);
    },
  };
}

async function setup() {
  const clock = mutableClock("2026-09-14T18:00:00.000Z");
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const owner: Actor = { userId: "user_1", organizationId: "org_1", role: "owner", emailVerified: true };
  const calendar = await createCalendarService({ calendars }).createCalendar(owner, { name: "Crew" });
  const event = await createEventService({ events, calendars }).createEvent(owner, {
    calendarId: calendar.id,
    title: "Launch party",
    startsAt: new Date("2026-09-20T19:00:00.000Z"),
    endsAt: new Date("2026-09-20T22:00:00.000Z"),
    status: "published",
    latitude: 48.85,
    longitude: 2.35,
  });
  const tickets: CachedTicket[] = [
    {
      registrationId: "reg_1",
      eventId: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      status: "confirmed",
      ticketCode: "T-SECRET",
      qrToken: "qr.secret-token-value",
    },
  ];
  const sent: Array<{ provider: string; token: string; category: string }> = [];
  const mobile = createMobileService({
    devices: createMemoryMobileDevices(),
    events,
    calendars,
    clock,
    home: {
      async attendeeHome() {
        return {
          events: [
            {
              registrationId: "reg_1",
              eventId: event.id,
              slug: event.slug,
              title: event.title,
              startsAt: event.startsAt.toISOString(),
              status: "confirmed",
            },
          ],
          calendars: [{ calendarId: calendar.id, name: calendar.name, slug: calendar.slug }],
          tickets,
        };
      },
    },
    push: {
      apns: {
        provider: "apns",
        isConfigured: () => true,
        async send(input) {
          sent.push({ provider: "apns", token: input.token, category: input.category });
          return { providerMessageId: "apns_1" };
        },
      },
      fcm: {
        provider: "fcm",
        isConfigured: () => false,
        async send() {
          throw new Error("FCM is not configured");
        },
      },
    },
  });
  return { mobile, event, calendar, clock, sent };
}

describe("mobile architecture", () => {
  it("exposes Discover, map, My Events, My Calendars, QR, notifications and offline cache", () => {
    expect([...MOBILE_FEATURES]).toEqual([
      "discover",
      "map",
      "my_events",
      "my_calendars",
      "qr",
      "notifications",
      "offline_cache",
    ]);
    expect(screensFor("ios").map((item) => item.feature)).toEqual([...MOBILE_FEATURES]);
    expect(NATIVE_SCREENS.map.source).toContain("/api/v1/discover/map");
    expect(NATIVE_SCREENS.discover.source).toContain("/api/v1/discover");
  });

  it("caches upcoming events, tickets and QR, and seals sensitive fields", async () => {
    const { mobile } = await setup();
    const open = await mobile.snapshot("ada");
    expect(open.cache.upcomingEvents[0]?.title).toBe("Launch party");
    expect(open.cache.tickets[0]?.qrToken).toBe("qr.secret-token-value");
    expect(open.cache.qrCodes[0]?.token).toBe("qr.secret-token-value");

    const sealed = await mobile.snapshot("ada", { deviceUnlockKey: "device-unlock-key-1" });
    expect(sealed.cache.tickets[0]?.qrToken).toBeNull();
    expect(sealed.cache.qrCodes).toEqual([]);
    expect(sealed.sealed).toBeTruthy();
    expect(sealedContainsPlaintext(sealed.sealed!, "qr.secret-token-value")).toBe(false);
    expect(mustEncryptAtRest("tickets.qrToken")).toBe(true);
    const opened = unsealSensitiveCache<{ tickets: CachedTicket[] }>(sealed.sealed!, "device-unlock-key-1");
    expect(opened.tickets[0]?.qrToken).toBe("qr.secret-token-value");
  });

  it("registers APNs and FCM devices and maps push categories", async () => {
    const { mobile, sent } = await setup();
    const ios = await mobile.registerDevice("ada", {
      platform: "ios",
      token: "apns-device-token-1234",
    });
    expect(ios.pushProvider).toBe("apns");
    const android = await mobile.registerDevice("ada", {
      platform: "android",
      token: "fcm-device-token-5678",
    });
    expect(android.pushProvider).toBe("fcm");
    expect([...MOBILE_PUSH_CATEGORIES]).toEqual(["new_event", "reminder", "update", "ticket", "check_in"]);
    const result = await mobile.notify("ada", {
      category: "reminder",
      title: "Tonight",
      body: "Doors at 19:00",
      deepLink: "pushoow://event/launch",
    });
    expect(result.attempted).toBe(2);
    expect(result.delivered).toBe(1);
    expect(result.skipped).toBe(1);
    expect(sent[0]?.provider).toBe("apns");
    await expect(
      mobile.registerDevice("ada", { platform: "ios", token: "fcm-device-token-xxxx", pushProvider: "fcm" }),
    ).rejects.toThrow(ValidationError);
  });

  it("resolves event, calendar and ticket deep links", async () => {
    const { mobile, event, calendar } = await setup();
    expect(parseDeepLink(`https://pushoow.test/e/${event.slug}`).kind).toBe("event");
    expect(parseDeepLink(`pushoow://calendar/${calendar.slug}`).kind).toBe("calendar");
    expect(parseDeepLink("pushoow://ticket/reg_1").kind).toBe("ticket");
    const eventLink = await mobile.resolveLink(`/e/${event.slug}`);
    expect(eventLink.eventId).toBe(event.id);
    const calendarLink = await mobile.resolveLink(`pushoow://calendar/${calendar.slug}`);
    expect(calendarLink.calendarId).toBe(calendar.id);
    const ticketLink = await mobile.resolveLink("https://pushoow.test/me/tickets/reg_1", "ada");
    expect(ticketLink.registrationId).toBe("reg_1");
    await expect(mobile.resolveLink("pushoow://ticket/reg_1")).rejects.toThrow(ValidationError);
    await expect(mobile.resolveLink("/e/missing")).rejects.toThrow(NotFoundError);
  });

  it("prepares next-event and countdown widgets as pull-only read models", async () => {
    const { mobile } = await setup();
    const widget = await mobile.widget("ada");
    expect(NATIVE_WIDGET_PROVIDERS.writeBack).toBe(false);
    expect(widget.nextEvent?.title).toBe("Launch party");
    expect(widget.countdownSeconds).toBe(6 * 24 * 3600 + 3600);
    expect(widget.refresh).toBe("pull");
  });

  it("prepares Apple Watch and Wear OS without shipping a fragile sync", async () => {
    const { mobile } = await setup();
    const boot = mobile.bootstrap();
    expect(WATCH_BIDIRECTIONAL_SYNC).toBe(false);
    expect(WATCH_SYNC_POLICY.serverChannel).toBe(false);
    expect(boot.watch.appleWatch).toBe(true);
    expect(boot.watch.wearOs).toBe(true);
    expect(boot.watch.bidirectionalSync).toBe(false);
    expect(NATIVE_WATCH_TARGETS.bidirectionalSync).toBe(false);
    expect(() => mobile.requestWatchSync()).toThrow(ValidationError);
    const snapshot = await mobile.snapshot("ada", { platform: "android" });
    expect(snapshot.watch.transport).toBe("wear_data_layer");
    expect(snapshot.watch.bidirectionalSync).toBe(false);
  });
});
