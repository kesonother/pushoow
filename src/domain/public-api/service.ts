import { createHash } from "node:crypto";
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/domain/errors";
import type { AnalyticsPlanRepository } from "@/domain/analytics/types";
import { decryptSecret, encryptSecret } from "@/domain/public-api/crypto";
import { signPublicWebhook, webhookBackoffMs } from "@/domain/public-api/signature";
import {
  PUBLIC_API_RATE_LIMITS,
  PUBLIC_API_SCOPES,
  PUBLIC_WEBHOOK_EVENTS,
  WEBHOOK_RETRY_WINDOW_MS,
  type PublicApiHttp,
  type PublicApiKey,
  type PublicApiKeyRepository,
  type PublicApiPlan,
  type PublicApiScope,
  type PublicOAuthClientRepository,
  type PublicOAuthCodeRepository,
  type PublicPrincipal,
  type PublicWebhookDelivery,
  type PublicWebhookDeliveryRepository,
  type PublicWebhookEndpointRepository,
  type PublicWebhookEvent,
  type PublicWebhookEventType,
} from "@/domain/public-api/types";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { canAccessFullDashboard } from "@/domain/rbac/dashboard";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type { JobType } from "@/jobs/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { childLogger } from "@/lib/logger";
import { encodeJson, randomToken, sha256, signPayload, safeEqual, decodeJson } from "@/lib/token-crypto";

const log = childLogger({ module: "public-api" });

export type PublicAccessClaims = {
  typ: "public_api";
  sub: string;
  org: string;
  cli?: string;
  scp: PublicApiScope[];
  plan: PublicApiPlan;
  iat: number;
  exp: number;
  jti: string;
};

export type PublicApiServiceDeps = {
  keys: PublicApiKeyRepository;
  clients: PublicOAuthClientRepository;
  codes: PublicOAuthCodeRepository;
  endpoints: PublicWebhookEndpointRepository;
  deliveries: PublicWebhookDeliveryRepository;
  plans?: AnalyticsPlanRepository;
  secret: string;
  http?: PublicApiHttp;
  enqueue?: (input: {
    type: JobType;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    availableAt?: Date;
    maxAttempts?: number;
  }) => Promise<unknown>;
  clock?: Clock;
  ids?: IdGenerator;
};

function hashKey(value: string) {
  return sha256(value);
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function assertManage(actor: Actor) {
  if (!canAccessFullDashboard(actor)) throw new ForbiddenError("This role cannot manage the public API");
  assertPermission(actor, "organization:update");
}

function rateLimitFor(plan: PublicApiPlan, override: number | null) {
  return override && override > 0 ? override : PUBLIC_API_RATE_LIMITS[plan];
}

function planFromAnalytics(plan: string | undefined): PublicApiPlan {
  if (plan === "pro" || plan === "plus" || plan === "enterprise") return plan;
  return "free";
}

export function createPublicApiService(deps: PublicApiServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const http = deps.http ?? {
    async request(input) {
      const response = await fetch(input.url, { method: input.method, headers: input.headers, body: input.body });
      return { status: response.status, text: await response.text() };
    },
  };

  function signAccess(claims: PublicAccessClaims) {
    const payload = encodeJson(claims);
    return `${payload}.${signPayload(payload, deps.secret)}`;
  }

  function verifyAccess(token: string): PublicAccessClaims {
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !safeEqual(signPayload(payload, deps.secret), signature)) {
      throw new UnauthorizedError("Invalid access token");
    }
    const claims = decodeJson<PublicAccessClaims>(payload);
    if (claims.typ !== "public_api" || claims.exp < Math.floor(clock.now().getTime() / 1000)) {
      throw new UnauthorizedError("Access token expired");
    }
    return claims;
  }

  async function authenticate(authorization: string | null, apiKeyHeader: string | null): Promise<PublicPrincipal> {
    const bearer = authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    const rawKey = apiKeyHeader?.trim() || (bearer.startsWith("pk_") ? bearer : "");
    if (rawKey) {
      const key = await deps.keys.findByHash(hashKey(rawKey));
      if (!key || key.revokedAt) throw new UnauthorizedError("Invalid API key");
      await deps.keys.save({ ...key, lastUsedAt: clock.now() });
      return {
        kind: "api_key",
        organizationId: key.organizationId,
        userId: `api_key:${key.id}`,
        scopes: key.scopes,
        plan: key.plan,
        rateLimitPerMinute: rateLimitFor(key.plan, key.rateLimitPerMinute),
        keyId: key.id,
      };
    }
    if (!bearer) throw new UnauthorizedError("API key or OAuth access token required");
    const claims = verifyAccess(bearer);
    return {
      kind: "oauth",
      organizationId: claims.org,
      userId: claims.sub,
      scopes: claims.scp,
      plan: claims.plan,
      rateLimitPerMinute: PUBLIC_API_RATE_LIMITS[claims.plan],
      clientId: claims.cli,
    };
  }

  function actorFrom(principal: PublicPrincipal): Actor {
    const write = principal.scopes.some((scope) => scope.endsWith(":write") || scope.endsWith(":manage"));
    const door = principal.scopes.includes("checkins:read") || principal.scopes.includes("checkins:write");
    return {
      userId: principal.userId,
      organizationId: principal.organizationId,
      role: write ? "admin" : door ? "check_in_manager" : "read_only",
      emailVerified: true,
    };
  }

  function assertScope(principal: PublicPrincipal, scope: PublicApiScope) {
    if (!principal.scopes.includes(scope)) {
      throw new ForbiddenError(`Missing scope ${scope}`);
    }
  }

  function assertOrg(principal: PublicPrincipal, organizationId: string) {
    if (principal.organizationId !== organizationId) {
      throw new ForbiddenError("Cross-tenant access is not allowed");
    }
  }

  async function createKey(actor: Actor, input: { name: string; scopes?: PublicApiScope[]; plan?: PublicApiPlan }) {
    assertManage(actor);
    const analytics = await deps.plans?.find(actor.organizationId);
    const plan = input.plan ?? planFromAnalytics(analytics?.plan);
    const plaintext = `pk_live_${randomToken(24)}`;
    const record = await deps.keys.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      name: input.name.trim() || "Default",
      keyHash: hashKey(plaintext),
      prefix: plaintext.slice(0, 12),
      scopes: input.scopes?.length ? input.scopes : [...PUBLIC_API_SCOPES],
      plan,
      rateLimitPerMinute: plan === "enterprise" ? 10_000 : null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: clock.now(),
    });
    return { key: { ...record, keyHash: undefined }, token: plaintext };
  }

  async function listKeys(actor: Actor) {
    assertManage(actor);
    return (await deps.keys.listByOrganization(actor.organizationId)).map((item) => ({
      ...item,
      keyHash: undefined,
    }));
  }

  async function revokeKey(actor: Actor, keyId: string) {
    assertManage(actor);
    const key = (await deps.keys.listByOrganization(actor.organizationId)).find((item) => item.id === keyId);
    if (!key) throw new NotFoundError("ApiKey", keyId);
    return deps.keys.save({ ...key, revokedAt: clock.now() });
  }

  async function createOAuthClient(actor: Actor, input: { name: string; redirectUris: string[] }) {
    assertManage(actor);
    if (!input.redirectUris.length) throw new ValidationError("At least one redirect URI is required");
    const secret = randomToken(24);
    const client = await deps.clients.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      name: input.name.trim() || "OAuth client",
      secretHash: hashKey(secret),
      redirectUris: input.redirectUris,
      scopes: [...PUBLIC_API_SCOPES],
      createdAt: clock.now(),
    });
    return { client: { ...client, secretHash: undefined }, clientSecret: secret };
  }

  async function authorize(input: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    userId: string;
    organizationId: string;
    codeChallengeMethod?: string;
  }) {
    const client = await deps.clients.findById(input.clientId);
    if (!client || client.organizationId !== input.organizationId) {
      throw new ValidationError("Unknown OAuth client");
    }
    if (!client.redirectUris.includes(input.redirectUri)) {
      throw new ValidationError("redirect_uri is not registered");
    }
    if (!input.codeChallenge) throw new ValidationError("PKCE code_challenge is required");
    if (input.codeChallengeMethod && input.codeChallengeMethod !== "S256") {
      throw new ValidationError("OAuth 2.1 requires PKCE S256");
    }
    const code = randomToken(24);
    await deps.codes.create({
      id: ids.id(),
      clientId: client.id,
      organizationId: client.organizationId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeHash: hashKey(code),
      codeChallenge: input.codeChallenge,
      expiresAt: new Date(clock.now().getTime() + 10 * 60 * 1000),
      consumedAt: null,
    });
    return { code };
  }

  async function token(input: {
    grantType: string;
    code?: string;
    redirectUri?: string;
    clientId: string;
    clientSecret?: string;
    codeVerifier?: string;
  }) {
    if (input.grantType !== "authorization_code") {
      throw new ValidationError("Unsupported grant_type. OAuth 2.1 uses authorization_code + PKCE.");
    }
    const client = await deps.clients.findById(input.clientId);
    if (!client) throw new UnauthorizedError("Invalid client");
    if (client.secretHash) {
      if (!input.clientSecret || hashKey(input.clientSecret) !== client.secretHash) {
        throw new UnauthorizedError("Invalid client secret");
      }
    }
    if (!input.code || !input.codeVerifier) throw new ValidationError("code and code_verifier are required");
    const record = await deps.codes.findByHash(hashKey(input.code));
    if (!record || record.clientId !== client.id) throw new UnauthorizedError("Invalid authorization code");
    if (record.consumedAt || record.expiresAt <= clock.now()) throw new UnauthorizedError("Authorization code expired");
    if (record.redirectUri !== input.redirectUri) throw new ValidationError("redirect_uri mismatch");
    if (record.codeChallenge !== pkceChallenge(input.codeVerifier)) {
      throw new UnauthorizedError("PKCE verification failed");
    }
    await deps.codes.save({ ...record, consumedAt: clock.now() });
    const analytics = await deps.plans?.find(client.organizationId);
    const plan = planFromAnalytics(analytics?.plan);
    const now = clock.now();
    const accessToken = signAccess({
      typ: "public_api",
      sub: record.userId,
      org: client.organizationId,
      cli: client.id,
      scp: client.scopes,
      plan,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(now.getTime() / 1000) + 15 * 60,
      jti: ids.id(),
    });
    return {
      token_type: "Bearer",
      access_token: accessToken,
      expires_in: 900,
      scope: client.scopes.join(" "),
    };
  }

  async function createWebhook(actor: Actor, input: { url: string; events: PublicWebhookEventType[] }) {
    assertManage(actor);
    if (!/^https:\/\//i.test(input.url) && !input.url.startsWith("http://localhost")) {
      throw new ValidationError("Webhook URL must be HTTPS");
    }
    const events = input.events.filter((event) =>
      (PUBLIC_WEBHOOK_EVENTS as readonly string[]).includes(event),
    );
    if (!events.length) throw new ValidationError("Select at least one webhook event");
    const secret = `whsec_${randomToken(24)}`;
    const endpoint = await deps.endpoints.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      url: input.url,
      secretCiphertext: encryptSecret(secret, deps.secret),
      events,
      active: true,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
    return { endpoint: { ...endpoint, secretCiphertext: undefined }, secret };
  }

  async function listWebhooks(actor: Actor) {
    assertManage(actor);
    return (await deps.endpoints.listByOrganization(actor.organizationId)).map((item) => ({
      ...item,
      secretCiphertext: undefined,
    }));
  }

  async function listDeliveries(actor: Actor, webhookId: string) {
    assertManage(actor);
    const endpoint = await deps.endpoints.findById(webhookId);
    assertSameTenant(endpoint, actor.organizationId, "Webhook");
    return deps.deliveries.listByEndpoint(endpoint.id);
  }

  async function emit(event: PublicWebhookEvent): Promise<void> {
    try {
      const endpoints = (await deps.endpoints.listByOrganization(event.organizationId)).filter(
        (item) => item.active && item.events.includes(event.type),
      );
      for (const endpoint of endpoints) {
        const delivery = await deps.deliveries.create({
          id: ids.id(),
          organizationId: event.organizationId,
          endpointId: endpoint.id,
          event: event.type,
          payload: { id: ids.id(), type: event.type, created: clock.now().toISOString(), data: event.data },
          status: "pending",
          attempts: 0,
          lastError: null,
          responseStatus: null,
          nextRetryAt: clock.now(),
          createdAt: clock.now(),
          updatedAt: clock.now(),
        });
        await deps.enqueue?.({
          type: "webhook.deliver",
          payload: { kind: "public", deliveryId: delivery.id },
          idempotencyKey: `public-wh:${delivery.id}:1`,
        });
      }
    } catch (error) {
      log.warn({ err: error, type: event.type }, "Public webhook emit ignored");
    }
  }

  async function attemptDelivery(deliveryId: string): Promise<PublicWebhookDelivery> {
    const delivery = await deps.deliveries.findById(deliveryId);
    if (!delivery) throw new ValidationError("Unknown webhook delivery");
    if (delivery.status === "delivered") return delivery;
    const endpoint = await deps.endpoints.findById(delivery.endpointId);
    if (!endpoint || !endpoint.active) {
      return deps.deliveries.save({ ...delivery, status: "dead", lastError: "Endpoint disabled", updatedAt: clock.now() });
    }
    if (clock.now().getTime() - delivery.createdAt.getTime() > WEBHOOK_RETRY_WINDOW_MS) {
      return deps.deliveries.save({ ...delivery, status: "dead", lastError: "Retry window exceeded (24h)", updatedAt: clock.now() });
    }
    const secret = decryptSecret(endpoint.secretCiphertext, deps.secret);
    const body = JSON.stringify(delivery.payload);
    const timestamp = clock.now().getTime();
    const signature = signPublicWebhook(secret, timestamp, body);
    const attempts = delivery.attempts + 1;
    try {
      const response = await http.request({
        url: endpoint.url,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": signature,
          "x-timestamp": String(timestamp),
          "x-event": delivery.event,
        },
        body,
      });
      if (response.status >= 200 && response.status < 300) {
        return deps.deliveries.save({
          ...delivery,
          status: "delivered",
          attempts,
          responseStatus: response.status,
          lastError: null,
          nextRetryAt: null,
          updatedAt: clock.now(),
        });
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      const nextRetryAt = new Date(clock.now().getTime() + webhookBackoffMs(attempts));
      const dead = clock.now().getTime() - delivery.createdAt.getTime() + webhookBackoffMs(attempts) > WEBHOOK_RETRY_WINDOW_MS;
      const saved = await deps.deliveries.save({
        ...delivery,
        status: dead ? "dead" : "failed",
        attempts,
        lastError: error instanceof Error ? error.message : "delivery failed",
        responseStatus: null,
        nextRetryAt: dead ? null : nextRetryAt,
        updatedAt: clock.now(),
      });
      if (!dead) {
        await deps.enqueue?.({
          type: "webhook.deliver",
          payload: { kind: "public", deliveryId: saved.id },
          idempotencyKey: `public-wh:${saved.id}:${attempts + 1}`,
          availableAt: nextRetryAt,
        });
      }
      return saved;
    }
  }

  async function retryDelivery(actor: Actor, webhookId: string, deliveryId?: string) {
    assertManage(actor);
    const endpoint = await deps.endpoints.findById(webhookId);
    assertSameTenant(endpoint, actor.organizationId, "Webhook");
    const deliveries = deliveryId
      ? [await deps.deliveries.findById(deliveryId)].filter(Boolean)
      : (await deps.deliveries.listByEndpoint(endpoint.id)).filter((item) => item.status !== "delivered");
    const retried = [];
    for (const delivery of deliveries) {
      if (!delivery) continue;
      await deps.deliveries.save({ ...delivery, status: "pending", nextRetryAt: clock.now(), updatedAt: clock.now() });
      retried.push(await attemptDelivery(delivery.id));
    }
    return retried;
  }

  return {
    authenticate,
    actorFrom,
    assertScope,
    assertOrg,
    createKey,
    listKeys,
    revokeKey,
    createOAuthClient,
    findClient: (id: string) => deps.clients.findById(id),
    authorize,
    token,
    createWebhook,
    listWebhooks,
    listDeliveries,
    emit,
    attemptDelivery,
    retryDelivery,
    verifyAccess,
  };
}

export async function emitPublicWebhook(
  emitter: { emit: (event: PublicWebhookEvent) => Promise<void> } | undefined,
  event: PublicWebhookEvent,
) {
  if (!emitter) return;
  try {
    await emitter.emit(event);
  } catch (error) {
    log.warn({ err: error, type: event.type }, "Public webhook emit ignored");
  }
}

export type PublicApiKeyView = Omit<PublicApiKey, "keyHash">;
