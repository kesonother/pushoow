import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import { createRegistrationService } from "@/domain/event/registration-service";
import { decryptCredentials } from "@/domain/integration/crypto";
import { emitIntegrationEvent } from "@/domain/integration/emit";
import { memoryIntegrationConnections, memoryIntegrationRefs } from "@/domain/integration/memory";
import { verifyOAuthState } from "@/domain/integration/oauth";
import { IntegrationError } from "@/domain/integration/provider";
import { createIntegrationRegistry } from "@/domain/integration/registry";
import { createIntegrationService } from "@/domain/integration/service";
import type {
  IntegrationDomainEvent,
  IntegrationHttp,
  IntegrationProvider,
  IntegrationSyncResult,
} from "@/domain/integration/types";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryCalendars,
  createMemoryCoupons,
  createMemoryAddOns,
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

const door: Actor = {
  userId: "door_1",
  organizationId: "org_1",
  role: "check_in_manager",
};

const outsider: Actor = {
  userId: "x",
  organizationId: "org_2",
  role: "owner",
  emailVerified: true,
};

const SECRET = "integration-test-secret-32-characters";

function recordingHttp(calls: Array<{ url: string; body: unknown }>, status = 200): IntegrationHttp {
  return {
    async request(input) {
      calls.push({ url: input.url, body: input.body });
      return { status, json: { id: "ext_1" } };
    },
  };
}

describe("integration architecture", () => {
  it("lists every prepared provider and can swap one", async () => {
    const registry = createIntegrationRegistry();
    expect(registry.list()).toHaveLength(16);
    const fake: IntegrationProvider = {
      ...registry.get("hubspot"),
      label: "HubSpot Sandbox",
      async sync(): Promise<IntegrationSyncResult> {
        return { exported: 42, skipped: 0, errors: [] };
      },
    };
    registry.register(fake);
    expect(registry.get("hubspot").label).toBe("HubSpot Sandbox");
    expect(await registry.get("hubspot").sync({} as never)).toEqual({
      exported: 42,
      skipped: 0,
      errors: [],
    });
  });

  it("stores API credentials encrypted and never returns them", async () => {
    const connections = memoryIntegrationConnections();
    const service = createIntegrationService({
      connections,
      refs: memoryIntegrationRefs(),
      secret: SECRET,
      appUrl: "http://localhost:3000",
    });
    const view = await service.connect(owner, "klaviyo", { apiKey: "pk_live_secret" });
    expect(view.connected).toBe(true);
    expect(JSON.stringify(view)).not.toContain("pk_live_secret");
    const stored = await connections.findByProvider("org_1", "klaviyo");
    expect(stored?.ciphertext).toBeTruthy();
    expect(stored?.ciphertext).not.toContain("pk_live_secret");
    expect(decryptCredentials(stored!.ciphertext, SECRET).apiKey).toBe("pk_live_secret");
  });

  it("blocks door staff and other tenants", async () => {
    const service = createIntegrationService({
      connections: memoryIntegrationConnections(),
      refs: memoryIntegrationRefs(),
      secret: SECRET,
      appUrl: "http://localhost:3000",
    });
    await service.connect(owner, "discord", { webhookUrl: "https://discord.com/api/webhooks/1" });
    await expect(service.connect(door, "discord", { webhookUrl: "https://x" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(service.disconnect(outsider, "discord")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("signs OAuth state and rejects a tampered one", async () => {
    process.env.SLACK_CLIENT_ID = "slack-id";
    process.env.SLACK_CLIENT_SECRET = "slack-secret";
    const service = createIntegrationService({
      connections: memoryIntegrationConnections(),
      refs: memoryIntegrationRefs(),
      secret: SECRET,
      appUrl: "http://localhost:3000",
    });
    const started = await service.startOAuth(owner, "slack");
    expect(started.authorizationUrl).toContain("slack.com/oauth");
    const state = verifyOAuthState(started.state, SECRET);
    expect(state.provider).toBe("slack");
    expect(state.organizationId).toBe("org_1");
    await expect(service.completeOAuth({ state: "nope.sig", code: "x" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
  });

  it("does not break registration when integrations throw", async () => {
    const events = createMemoryEvents();
    const calendars = createMemoryCalendars();
    const registrations = createMemoryRegistrations();
    const calendar = await createCalendarService({ calendars }).createCalendar(owner, { name: "I/O" });
    const eventService = createEventService({ events, calendars });
    const event = await eventService.createEvent(owner, {
      calendarId: calendar.id,
      title: "Talk",
      startsAt: new Date("2026-11-01T18:00:00.000Z"),
      endsAt: new Date("2026-11-01T20:00:00.000Z"),
      status: "published",
    });
    const register = createRegistrationService({
      events,
      registrations,
      tickets: createMemoryTickets(),
      coupons: createMemoryCoupons(),
      addOns: createMemoryAddOns(),
      orders: createMemoryOrders(),
      integrations: {
        async emit() {
          throw new IntegrationError("CRM down");
        },
      },
    });
    const guest = await register.register({
      eventId: event.id,
      email: "ada@example.com",
    });
    expect(guest.email).toBe("ada@example.com");
    expect((await registrations.listByEvent(event.id)).length).toBe(1);
  });

  it("swallows emit failures and retries retryable sync errors", async () => {
    const events: IntegrationDomainEvent[] = [];
    await emitIntegrationEvent(
      {
        async emit(event) {
          events.push(event);
          throw new Error("boom");
        },
      },
      {
        type: "registrant.created",
        organizationId: "org_1",
        eventId: "evt",
        registrationId: "reg",
        email: "ada@example.com",
        status: "confirmed",
      },
    );
    expect(events).toHaveLength(1);

    const calls: Array<{ url: string; body: unknown }> = [];
    const connections = memoryIntegrationConnections();
    const service = createIntegrationService({
      connections,
      refs: memoryIntegrationRefs(),
      secret: SECRET,
      appUrl: "http://localhost:3000",
      http: recordingHttp(calls, 503),
    });
    await service.connect(owner, "klaviyo", { apiKey: "pk_test" });
    await expect(
      service.processSyncJob({
        type: "registrant.created",
        organizationId: owner.organizationId,
        eventId: "evt",
        registrationId: "reg",
        email: "ada@example.com",
        status: "confirmed",
      }),
    ).rejects.toBeInstanceOf(IntegrationError);
  });

  it("exports CRM objects through the swapped HTTP adapter", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const calendars = createMemoryCalendars();
    const events = createMemoryEvents();
    const registrations = createMemoryRegistrations();
    const calendar = await createCalendarService({ calendars }).createCalendar(owner, { name: "HQ" });
    const event = await createEventService({ events, calendars }).createEvent(owner, {
      calendarId: calendar.id,
      title: "Launch",
      startsAt: new Date("2026-11-01T18:00:00.000Z"),
      endsAt: new Date("2026-11-01T20:00:00.000Z"),
    });
    await registrations.create({
      id: "reg_1",
      organizationId: owner.organizationId,
      calendarId: calendar.id,
      eventId: event.id,
      userId: null,
      email: "ada@example.com",
      status: "confirmed",
      occurrenceStartsAt: null,
      orderId: null,
      ticketTypeId: null,
      quantity: 1,
      offeredUntil: null,
      waitlistPosition: null,
      anonymous: false,
      appearOnRoster: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createIntegrationService({
      connections: memoryIntegrationConnections(),
      refs: memoryIntegrationRefs(),
      secret: SECRET,
      appUrl: "http://localhost:3000",
      http: recordingHttp(calls),
      events,
      calendars,
      registrations,
    });
    await service.connect(owner, "pipedrive", { apiKey: "pd_token" });
    const result = await service.sync(owner, "pipedrive");
    expect(result.exported).toBeGreaterThan(0);
    expect(calls.some((call) => String(call.url).includes("pipedrive"))).toBe(true);
  });

  it("wipes ciphertext on disconnect", async () => {
    const connections = memoryIntegrationConnections();
    const service = createIntegrationService({
      connections,
      refs: memoryIntegrationRefs(),
      secret: SECRET,
      appUrl: "http://localhost:3000",
    });
    await service.connect(owner, "customerio", { siteId: "site", apiKey: "cio_key" });
    await service.disconnect(owner, "customerio");
    const stored = await connections.findByProvider("org_1", "customerio");
    expect(stored?.ciphertext).toBe("");
    expect(stored?.status).toBe("disconnected");
  });
});
