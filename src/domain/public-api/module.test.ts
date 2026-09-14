import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/domain/errors";
import {
  memoryPublicApiKeys,
  memoryPublicOAuthClients,
  memoryPublicOAuthCodes,
  memoryPublicWebhookDeliveries,
  memoryPublicWebhookEndpoints,
} from "@/domain/public-api/memory";
import { PUBLIC_EVENT_V1_FIELDS, presentEvent } from "@/domain/public-api/present";
import { createPublicApiService, emitPublicWebhook } from "@/domain/public-api/service";
import {
  signPublicWebhook,
  verifyPublicWebhookSignature,
  webhookBackoffMs,
} from "@/domain/public-api/signature";
import {
  PUBLIC_API_DEPRECATION_MONTHS,
  PUBLIC_API_RATE_LIMITS,
  PUBLIC_API_SCOPES,
  PUBLIC_API_VERSION,
} from "@/domain/public-api/types";
import { isSupportedPublicVersion, publicApiVersionPolicy } from "@/domain/public-api/version";
import type { Actor } from "@/domain/rbac/permissions";
import type { Event } from "@/domain/event/types";

const SECRET = "public-api-test-secret-32-characters";

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

function harness(opts?: { now?: () => Date; http?: { status: number }; plan?: "free" | "pro" | "plus" }) {
  let now = new Date("2026-09-14T12:00:00.000Z");
  const jobs: Array<{ type: string; payload: Record<string, unknown>; availableAt?: Date }> = [];
  const httpCalls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const service = createPublicApiService({
    keys: memoryPublicApiKeys(),
    clients: memoryPublicOAuthClients(),
    codes: memoryPublicOAuthCodes(),
    endpoints: memoryPublicWebhookEndpoints(),
    deliveries: memoryPublicWebhookDeliveries(),
    plans: {
      async find() {
        return opts?.plan ? { organizationId: "org_1", plan: opts.plan, updatedAt: now } : null;
      },
      async save(item) {
        return item;
      },
    },
    secret: SECRET,
    clock: { now: opts?.now ?? (() => now) },
    http: {
      async request(input) {
        httpCalls.push(input);
        return { status: opts?.http?.status ?? 200, text: "ok" };
      },
    },
    enqueue: async (input) => {
      jobs.push(input);
      return input;
    },
  });
  return {
    service,
    jobs,
    httpCalls,
    setNow(value: Date) {
      now = value;
    },
    now() {
      return now;
    },
  };
}

describe("public API authentication", () => {
  it("authenticates API keys and OAuth 2.1 + PKCE", async () => {
    const { service } = harness({ plan: "pro" });
    const created = await service.createKey(owner, { name: "CI" });
    expect(created.token.startsWith("pk_live_")).toBe(true);
    expect(created.key.keyHash).toBeUndefined();

    const viaBearer = await service.authenticate(`Bearer ${created.token}`, null);
    expect(viaBearer.organizationId).toBe("org_1");
    expect(viaBearer.rateLimitPerMinute).toBe(1000);

    const viaHeader = await service.authenticate(null, created.token);
    expect(viaHeader.keyId).toBe(created.key.id);

    const client = await service.createOAuthClient(owner, {
      name: "App",
      redirectUris: ["https://app.example/callback"],
    });
    const verifier = "oauth21-code-verifier-value";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const { code } = await service.authorize({
      clientId: client.client.id,
      redirectUri: "https://app.example/callback",
      codeChallenge: challenge,
      userId: owner.userId,
      organizationId: owner.organizationId,
    });
    const token = await service.token({
      grantType: "authorization_code",
      code,
      redirectUri: "https://app.example/callback",
      clientId: client.client.id,
      clientSecret: client.clientSecret,
      codeVerifier: verifier,
    });
    const principal = await service.authenticate(`Bearer ${token.access_token}`, null);
    expect(principal.kind).toBe("oauth");
    expect(principal.organizationId).toBe("org_1");
  });

  it("rejects missing auth, reused codes, and door staff key management", async () => {
    const { service } = harness();
    await expect(service.authenticate(null, null)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(service.createKey(door, { name: "nope" })).rejects.toBeInstanceOf(ForbiddenError);

    const client = await service.createOAuthClient(owner, {
      name: "App",
      redirectUris: ["https://app.example/callback"],
    });
    const verifier = "oauth21-code-verifier-value";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const { code } = await service.authorize({
      clientId: client.client.id,
      redirectUri: "https://app.example/callback",
      codeChallenge: challenge,
      userId: owner.userId,
      organizationId: owner.organizationId,
    });
    await service.token({
      grantType: "authorization_code",
      code,
      redirectUri: "https://app.example/callback",
      clientId: client.client.id,
      clientSecret: client.clientSecret,
      codeVerifier: verifier,
    });
    await expect(
      service.token({
        grantType: "authorization_code",
        code,
        redirectUri: "https://app.example/callback",
        clientId: client.client.id,
        clientSecret: client.clientSecret,
        codeVerifier: verifier,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(
      service.authorize({
        clientId: client.client.id,
        redirectUri: "https://app.example/callback",
        codeChallenge: challenge,
        codeChallengeMethod: "plain",
        userId: owner.userId,
        organizationId: owner.organizationId,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("public API rate limits and tenant isolation", () => {
  it("applies 100/min default, 1000/min Pro+, and enterprise custom limits", async () => {
    expect(PUBLIC_API_RATE_LIMITS.free).toBe(100);
    expect(PUBLIC_API_RATE_LIMITS.pro).toBe(1000);
    expect(PUBLIC_API_RATE_LIMITS.plus).toBe(1000);
    const free = harness();
    const pro = harness({ plan: "pro" });
    const freeKey = await free.service.createKey(owner, { name: "free" });
    const proKey = await pro.service.createKey(owner, { name: "pro" });
    const enterprise = await free.service.createKey(owner, { name: "ent", plan: "enterprise" });
    expect((await free.service.authenticate(null, freeKey.token)).rateLimitPerMinute).toBe(100);
    expect((await pro.service.authenticate(null, proKey.token)).rateLimitPerMinute).toBe(1000);
    expect((await free.service.authenticate(null, enterprise.token)).rateLimitPerMinute).toBe(10_000);
  });

  it("keeps credentials and webhooks inside the issuing organization", async () => {
    const { service } = harness();
    const key = await service.createKey(owner, { name: "org1" });
    const principal = await service.authenticate(null, key.token);
    expect(() => service.assertOrg(principal, "org_2")).toThrow(ForbiddenError);
    const created = await service.createWebhook(owner, { url: "https://hooks.example/v1", events: ["event.created"] });
    await service.emit({ type: "event.created", organizationId: "org_2", data: { id: "evt_x" } });
    expect(await service.listDeliveries(owner, created.endpoint.id)).toHaveLength(0);
    await service.emit({ type: "event.created", organizationId: "org_1", data: { id: "evt_1" } });
    expect(await service.listDeliveries(owner, created.endpoint.id)).toHaveLength(1);
    await expect(service.listDeliveries(outsider, created.endpoint.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("public webhook signatures, replay, and retries", () => {
  it("signs HMAC-SHA256 with timestamp and rejects replayed payloads", () => {
    const body = JSON.stringify({ type: "event.created" });
    const timestamp = Date.parse("2026-09-14T12:00:00.000Z");
    const header = signPublicWebhook("whsec_test", timestamp, body);
    expect(header).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
    expect(verifyPublicWebhookSignature({ secret: "whsec_test", header, body, now: timestamp }).timestamp).toBe(
      timestamp,
    );
    expect(() =>
      verifyPublicWebhookSignature({
        secret: "whsec_test",
        header,
        body,
        now: timestamp + 6 * 60 * 1000,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      verifyPublicWebhookSignature({ secret: "whsec_other", header, body, now: timestamp }),
    ).toThrow(ValidationError);
  });

  it("retries with exponential backoff for 24h and supports a manual retry", async () => {
    expect(webhookBackoffMs(1)).toBe(30_000);
    expect(webhookBackoffMs(2)).toBe(60_000);
    expect(webhookBackoffMs(12)).toBe(6 * 60 * 60 * 1000);
    const failing = harness({ http: { status: 500 } });
    await failing.service.createWebhook(owner, { url: "https://hooks.example/v1", events: ["event.created"] });
    await failing.service.emit({ type: "event.created", organizationId: "org_1", data: { id: "evt_1" } });
    const firstJob = failing.jobs.find((job) => job.payload.kind === "public");
    const deliveryId = String(firstJob?.payload.deliveryId);
    const failed = await failing.service.attemptDelivery(deliveryId);
    expect(failed.status).toBe("failed");
    expect(failed.nextRetryAt).toBeTruthy();
    expect(failing.jobs.some((job) => job.availableAt)).toBe(true);

    failing.setNow(new Date(failing.now().getTime() + 25 * 60 * 60 * 1000));
    const dead = await failing.service.attemptDelivery(deliveryId);
    expect(dead.status).toBe("dead");

    const ok = harness();
    const hook = await ok.service.createWebhook(owner, { url: "https://hooks.example/v1", events: ["payment.completed"] });
    await ok.service.emit({ type: "payment.completed", organizationId: "org_1", data: { id: "pay_1" } });
    const delivered = await ok.service.attemptDelivery(String(ok.jobs[0]?.payload.deliveryId));
    expect(delivered.status).toBe("delivered");
    expect(ok.httpCalls[0]?.headers["x-signature"]).toMatch(/^t=\d+,v1=/);
    const retried = await ok.service.retryDelivery(owner, hook.endpoint.id, delivered.id);
    expect(retried[0]?.status).toBe("delivered");
  });

  it("never throws when emitPublicWebhook fails", async () => {
    await expect(
      emitPublicWebhook(
        {
          async emit() {
            throw new Error("boom");
          },
        },
        { type: "event.created", organizationId: "org_1", data: {} },
      ),
    ).resolves.toBeUndefined();
  });
});

describe("public API versioning backward compatibility", () => {
  it("keeps v1 fields and a 12-month deprecation policy", () => {
    expect(PUBLIC_API_VERSION).toBe("v1");
    expect(publicApiVersionPolicy().deprecationMonths).toBe(12);
    expect(PUBLIC_API_DEPRECATION_MONTHS).toBe(12);
    expect(isSupportedPublicVersion("v1")).toBe(true);
    expect(isSupportedPublicVersion("v2")).toBe(false);
    expect(isSupportedPublicVersion(null)).toBe(true);
    const event = presentEvent({
      id: "evt_1",
      organizationId: "org_1",
      calendarId: "cal_1",
      slug: "talk",
      title: "Talk",
      description: null,
      status: "published",
      visibility: "public",
      startsAt: new Date("2026-10-01T18:00:00.000Z"),
      endsAt: new Date("2026-10-01T20:00:00.000Z"),
      timezone: "UTC",
      isPaid: false,
      capacity: 40,
      venueName: null,
      city: null,
      country: null,
    } as Event);
    expect(Object.keys(event)).toEqual([...PUBLIC_EVENT_V1_FIELDS]);
    expect(PUBLIC_API_SCOPES).toContain("events:read");
  });
});
