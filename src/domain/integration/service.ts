import { ForbiddenError, ValidationError } from "@/domain/errors";
import type { CalendarRepository } from "@/domain/calendar/types";
import type { EventOrder } from "@/domain/event/commerce-types";
import type { EventRegistrationRepository, OrderRepository } from "@/domain/event/commerce-types";
import type { EventRepository } from "@/domain/event/types";
import { specById } from "@/domain/integration/catalog";
import { decryptCredentials, encryptCredentials, hasStoredSecret } from "@/domain/integration/crypto";
import { signOAuthState, verifyOAuthState } from "@/domain/integration/oauth";
import { IntegrationError, defaultIntegrationHttp, integrationNotConfigured } from "@/domain/integration/provider";
import type { IntegrationRegistry } from "@/domain/integration/registry";
import { createIntegrationRegistry } from "@/domain/integration/registry";
import type {
  IntegrationConnection,
  IntegrationConnectionRepository,
  IntegrationConnectionView,
  IntegrationCredentials,
  IntegrationDomainEvent,
  IntegrationHttp,
  IntegrationProviderId,
  IntegrationRefRepository,
  IntegrationSyncObject,
  IntegrationSyncResult,
} from "@/domain/integration/types";
import { INTEGRATION_PROVIDER_IDS } from "@/domain/integration/types";
import { assertPermission, type Actor } from "@/domain/rbac/permissions";
import { canAccessFullDashboard } from "@/domain/rbac/dashboard";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type { JobType } from "@/jobs/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { childLogger } from "@/lib/logger";

const log = childLogger({ module: "integration" });

export type IntegrationServiceDeps = {
  connections: IntegrationConnectionRepository;
  refs: IntegrationRefRepository;
  secret: string;
  appUrl: string;
  registry?: IntegrationRegistry;
  http?: IntegrationHttp;
  events?: EventRepository;
  calendars?: CalendarRepository;
  registrations?: EventRegistrationRepository;
  orders?: OrderRepository;
  listCheckIns?: (eventId: string) => Promise<Array<{ id: string; registrationId: string; checkedInAt: Date }>>;
  enqueue?: (input: {
    type: JobType;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    maxAttempts?: number;
  }) => Promise<unknown>;
  clock?: Clock;
  ids?: IdGenerator;
};

function assertProviderId(value: string): IntegrationProviderId {
  if (!INTEGRATION_PROVIDER_IDS.includes(value as IntegrationProviderId)) {
    throw new ValidationError("Unknown integration provider", { provider: value });
  }
  return value as IntegrationProviderId;
}

function assertManage(actor: Actor) {
  if (!canAccessFullDashboard(actor)) {
    throw new ForbiddenError("This role cannot manage integrations");
  }
  assertPermission(actor, "integrations:manage");
}

function omitCiphertext(item: IntegrationConnection): Omit<IntegrationConnection, "ciphertext"> {
  const { ciphertext, ...rest } = item;
  void ciphertext;
  return rest;
}

export function createIntegrationService(deps: IntegrationServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const registry = deps.registry ?? createIntegrationRegistry();
  const http = deps.http ?? defaultIntegrationHttp();

  function toView(item: IntegrationConnection): IntegrationConnectionView {
    const provider = registry.get(item.provider);
    return {
      ...omitCiphertext(item),
      category: provider.category,
      label: provider.label,
      authType: provider.authType,
      capabilities: provider.capabilities,
      configured: provider.isConfigured(),
      connected: item.status === "connected",
      credentialFields: provider.credentialFields,
    };
  }

  function redirectUri() {
    return `${deps.appUrl.replace(/\/$/, "")}/api/v1/integrations/oauth/callback`;
  }

  async function catalog(actor: Actor): Promise<IntegrationConnectionView[]> {
    assertPermission(actor, "organization:read");
    const existing = await deps.connections.listByOrganization(actor.organizationId);
    const byProvider = new Map(existing.map((item) => [item.provider, item]));
    return registry.list().map((provider) => {
      const item = byProvider.get(provider.id);
      if (item) return toView(item);
      return {
        id: provider.id,
        organizationId: actor.organizationId,
        provider: provider.id,
        status: "disconnected",
        scopes: [],
        externalAccountId: null,
        lastSyncAt: null,
        lastError: null,
        createdAt: clock.now(),
        updatedAt: clock.now(),
        category: provider.category,
        label: provider.label,
        authType: provider.authType,
        capabilities: provider.capabilities,
        configured: provider.isConfigured(),
        connected: false,
        credentialFields: provider.credentialFields,
      };
    });
  }

  async function upsertConnection(
    organizationId: string,
    providerId: IntegrationProviderId,
    patch: Partial<IntegrationConnection> & { credentials?: IntegrationCredentials },
  ) {
    const existing = await deps.connections.findByProvider(organizationId, providerId);
    const now = clock.now();
    const ciphertext = patch.credentials
      ? encryptCredentials(patch.credentials, deps.secret)
      : (existing?.ciphertext ?? "");
    if (existing) {
      return deps.connections.save({
        ...existing,
        status: patch.status ?? existing.status,
        ciphertext,
        scopes: patch.scopes ?? existing.scopes,
        externalAccountId: patch.externalAccountId ?? existing.externalAccountId,
        lastSyncAt: patch.lastSyncAt ?? existing.lastSyncAt,
        lastError: patch.lastError === undefined ? existing.lastError : patch.lastError,
        updatedAt: now,
      });
    }
    return deps.connections.create({
      id: ids.id(),
      organizationId,
      provider: providerId,
      status: patch.status ?? "disconnected",
      ciphertext,
      scopes: patch.scopes ?? specById(providerId).scopes ?? [],
      externalAccountId: patch.externalAccountId ?? null,
      lastSyncAt: patch.lastSyncAt ?? null,
      lastError: patch.lastError ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function connect(actor: Actor, providerId: string, credentials: IntegrationCredentials) {
    assertManage(actor);
    const id = assertProviderId(providerId);
    const provider = registry.get(id);
    if (!provider.isConfigured() && provider.authType === "oauth") {
      throw integrationNotConfigured(provider.label);
    }
    const stored = await provider.connect({ organizationId: actor.organizationId, credentials });
    const connection = await upsertConnection(actor.organizationId, id, {
      status: "connected",
      credentials: stored,
      lastError: null,
    });
    return toView(connection);
  }

  async function startOAuth(actor: Actor, providerId: string) {
    assertManage(actor);
    const id = assertProviderId(providerId);
    const provider = registry.get(id);
    if (!provider.isConfigured()) throw integrationNotConfigured(provider.label);
    const state = signOAuthState(
      {
        organizationId: actor.organizationId,
        userId: actor.userId,
        provider: id,
        exp: Date.now() + 15 * 60 * 1000,
      },
      deps.secret,
    );
    await upsertConnection(actor.organizationId, id, { status: "pending" });
    return provider.startOAuth({ redirectUri: redirectUri(), state });
  }

  async function completeOAuth(input: { state: string; code: string }) {
    const state = verifyOAuthState(input.state, deps.secret);
    const provider = registry.get(state.provider);
    const credentials = await provider.completeOAuth({
      code: input.code,
      redirectUri: redirectUri(),
      http,
    });
    const connection = await upsertConnection(state.organizationId, state.provider, {
      status: "connected",
      credentials,
      lastError: null,
    });
    return { connection: toView(connection), organizationId: state.organizationId };
  }

  async function disconnect(actor: Actor, providerId: string) {
    assertManage(actor);
    const id = assertProviderId(providerId);
    const existing = await deps.connections.findByProvider(actor.organizationId, id);
    assertSameTenant(existing, actor.organizationId, "Integration");
    const credentials = decryptCredentials(existing.ciphertext, deps.secret);
    try {
      await registry.get(id).disconnect({ credentials, http });
    } catch (error) {
      log.warn({ err: error, provider: id }, "Provider disconnect failed");
    }
    await deps.connections.save({
      ...existing,
      status: "disconnected",
      ciphertext: "",
      lastError: null,
      updatedAt: clock.now(),
    });
  }

  async function collectObjects(
    organizationId: string,
    providerId: IntegrationProviderId,
    event?: IntegrationDomainEvent,
  ): Promise<IntegrationSyncObject[]> {
    const provider = registry.get(providerId);
    const objects: IntegrationSyncObject[] = [];
    if (event) {
      objects.push({
        type: event.type === "event.upsert" || event.type === "event.cancelled" ? "event" : "contact",
        localId: "registrationId" in event ? (event.registrationId ?? event.eventId) : event.eventId,
        payload: { ...event },
      });
      if (event.type === "check_in") {
        objects.push({ type: "attendance", localId: event.registrationId, payload: { ...event } });
      }
      if (event.type === "cancellation" || event.type === "event.cancelled") {
        objects.push({ type: "message", localId: event.eventId, payload: { ...event } });
      }
      return objects;
    }

    const events = deps.events?.listByOrganization
      ? await deps.events.listByOrganization(organizationId)
      : [];
    const calendars = deps.calendars ? await deps.calendars.listByOrganization(organizationId) : [];
    const registrations = deps.registrations?.listByOrganization
      ? await deps.registrations.listByOrganization(organizationId)
      : [];
    const orders: EventOrder[] = deps.orders?.listByOrganization
      ? await deps.orders.listByOrganization(organizationId)
      : [];

    if (provider.capabilities.includes("accounts")) {
      for (const calendar of calendars) {
        objects.push({
          type: "account",
          localId: calendar.id,
          payload: { name: calendar.name, timezone: calendar.timezone },
        });
      }
    }
    if (
      provider.capabilities.includes("contacts") ||
      provider.capabilities.includes("leads") ||
      provider.capabilities.includes("registrant.created")
    ) {
      for (const registration of registrations) {
        objects.push({
          type: registration.status === "pending" ? "lead" : "contact",
          localId: registration.id,
          payload: {
            email: registration.email,
            status: registration.status,
            eventId: registration.eventId,
          },
        });
      }
    }
    if (provider.capabilities.includes("deals")) {
      for (const order of orders) {
        objects.push({
          type: "deal",
          localId: order.id,
          payload: { email: order.buyerEmail, totalCents: order.totalCents, status: order.status },
        });
      }
    }
    if (provider.capabilities.includes("attendance") || provider.capabilities.includes("activities")) {
      for (const eventItem of events) {
        const records = deps.listCheckIns ? await deps.listCheckIns(eventItem.id) : [];
        for (const record of records) {
          objects.push({
            type: "attendance",
            localId: record.id,
            payload: { registrationId: record.registrationId, checkedInAt: record.checkedInAt.toISOString() },
          });
        }
      }
    }
    if (provider.capabilities.includes("calendar.sync") || provider.capabilities.includes("meetings") || provider.capabilities.includes("streams") || provider.capabilities.includes("pages")) {
      for (const eventItem of events.filter((item) => !item.deletedAt)) {
        objects.push({
          type: "event",
          localId: eventItem.id,
          payload: {
            title: eventItem.title,
            startsAt: eventItem.startsAt.toISOString(),
            endsAt: eventItem.endsAt.toISOString(),
            status: eventItem.status,
          },
        });
      }
    }
    return objects;
  }

  async function runProviderSync(
    organizationId: string,
    providerId: IntegrationProviderId,
    event?: IntegrationDomainEvent,
  ): Promise<IntegrationSyncResult> {
    const connection = await deps.connections.findByProvider(organizationId, providerId);
    if (!connection || connection.status !== "connected") {
      return { exported: 0, skipped: 1, errors: [] };
    }
    const credentials = decryptCredentials(connection.ciphertext, deps.secret);
    if (!hasStoredSecret(credentials)) {
      return { exported: 0, skipped: 1, errors: [] };
    }
    const objects = await collectObjects(organizationId, providerId, event);
    const result = await registry.get(providerId).sync({
      organizationId,
      connection,
      credentials,
      objects,
      event,
      http,
    });
    await deps.connections.save({
      ...connection,
      lastSyncAt: clock.now(),
      lastError: result.errors[0]?.message ?? null,
      status: result.errors.length ? "error" : "connected",
      updatedAt: clock.now(),
    });
    for (const object of objects) {
      const existing = await deps.refs.find(organizationId, providerId, object.type, object.localId);
      if (!existing) {
        await deps.refs.save({
          id: ids.id(),
          organizationId,
          provider: providerId,
          objectType: object.type,
          localId: object.localId,
          externalId: object.localId,
          updatedAt: clock.now(),
        });
      }
    }
    return result;
  }

  async function sync(actor: Actor, providerId: string): Promise<IntegrationSyncResult> {
    assertManage(actor);
    const id = assertProviderId(providerId);
    const existing = await deps.connections.findByProvider(actor.organizationId, id);
    assertSameTenant(existing, actor.organizationId, "Integration");
    return runProviderSync(actor.organizationId, id);
  }

  async function emit(event: IntegrationDomainEvent): Promise<void> {
    try {
      await deps.enqueue?.({
        type: "sync.run",
        payload: event as unknown as Record<string, unknown>,
        idempotencyKey: `integration:${event.type}:${event.organizationId}:${"registrationId" in event ? event.registrationId : event.eventId}:${event.type === "event.upsert" ? event.eventId : event.type}`,
        maxAttempts: 5,
      });
    } catch (error) {
      log.warn({ err: error, type: event.type }, "Integration enqueue ignored");
    }
  }

  async function processSyncJob(payload: Record<string, unknown>): Promise<void> {
    const organizationId = String(payload.organizationId ?? "");
    if (!organizationId) return;
    const connections = await deps.connections.listByOrganization(organizationId);
    const event = payload.type
      ? (payload as unknown as IntegrationDomainEvent)
      : undefined;
    for (const connection of connections) {
      if (connection.status !== "connected") continue;
      try {
        await runProviderSync(organizationId, connection.provider, event);
      } catch (error) {
        if (error instanceof IntegrationError && error.retryable) throw error;
        log.warn({ err: error, provider: connection.provider }, "Integration sync skipped");
        await deps.connections.save({
          ...connection,
          lastError: error instanceof Error ? error.message : "sync failed",
          status: "error",
          updatedAt: clock.now(),
        });
      }
    }
  }

  async function handleWebhook(
    organizationId: string,
    providerId: string,
    headers: Record<string, string>,
    rawBody: string,
  ) {
    const id = assertProviderId(providerId);
    const connection = await deps.connections.findByProvider(organizationId, id);
    const credentials = connection ? decryptCredentials(connection.ciphertext, deps.secret) : null;
    return registry.get(id).handleWebhook({ headers, rawBody, credentials });
  }

  return {
    catalog,
    connect,
    startOAuth,
    completeOAuth,
    disconnect,
    sync,
    emit,
    processSyncJob,
    handleWebhook,
    registry,
  };
}
