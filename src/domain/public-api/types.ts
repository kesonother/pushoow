export const PUBLIC_API_VERSION = "v1";
export const PUBLIC_API_RELEASED_AT = "2026-09-14";
export const PUBLIC_API_DEPRECATION_MONTHS = 12;

export const PUBLIC_API_PLANS = ["free", "pro", "plus", "enterprise"] as const;
export type PublicApiPlan = (typeof PUBLIC_API_PLANS)[number];

export const PUBLIC_API_RATE_LIMITS: Record<PublicApiPlan, number> = {
  free: 100,
  pro: 1000,
  plus: 1000,
  enterprise: 5000,
};

export const PUBLIC_API_SCOPES = [
  "organizations:read",
  "calendars:read",
  "events:read",
  "events:write",
  "registrations:read",
  "registrations:write",
  "tickets:read",
  "attendees:read",
  "checkins:read",
  "checkins:write",
  "payments:read",
  "refunds:write",
  "webhooks:manage",
] as const;
export type PublicApiScope = (typeof PUBLIC_API_SCOPES)[number];

export const PUBLIC_WEBHOOK_EVENTS = [
  "event.created",
  "event.updated",
  "event.cancelled",
  "rsvp.created",
  "rsvp.updated",
  "rsvp.cancelled",
  "payment.completed",
  "refund.issued",
  "checkin.completed",
] as const;
export type PublicWebhookEventType = (typeof PUBLIC_WEBHOOK_EVENTS)[number];

export const WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;
export const WEBHOOK_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type PublicApiKey = {
  id: string;
  organizationId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: PublicApiScope[];
  plan: PublicApiPlan;
  rateLimitPerMinute: number | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type PublicOAuthClient = {
  id: string;
  organizationId: string;
  name: string;
  secretHash: string | null;
  redirectUris: string[];
  scopes: PublicApiScope[];
  createdAt: Date;
};

export type PublicOAuthCode = {
  id: string;
  clientId: string;
  organizationId: string;
  userId: string;
  redirectUri: string;
  codeHash: string;
  codeChallenge: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type PublicWebhookEndpoint = {
  id: string;
  organizationId: string;
  url: string;
  secretCiphertext: string;
  events: PublicWebhookEventType[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicWebhookDelivery = {
  id: string;
  organizationId: string;
  endpointId: string;
  event: PublicWebhookEventType;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed" | "dead";
  attempts: number;
  lastError: string | null;
  responseStatus: number | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicPrincipal = {
  kind: "api_key" | "oauth";
  organizationId: string;
  userId: string;
  scopes: PublicApiScope[];
  plan: PublicApiPlan;
  rateLimitPerMinute: number;
  keyId?: string;
  clientId?: string;
};

export type PublicWebhookEvent = {
  type: PublicWebhookEventType;
  organizationId: string;
  data: Record<string, unknown>;
};

export type PublicApiKeyRepository = {
  create: (item: PublicApiKey) => Promise<PublicApiKey>;
  findByHash: (keyHash: string) => Promise<PublicApiKey | null>;
  listByOrganization: (organizationId: string) => Promise<PublicApiKey[]>;
  save: (item: PublicApiKey) => Promise<PublicApiKey>;
};

export type PublicOAuthClientRepository = {
  create: (item: PublicOAuthClient) => Promise<PublicOAuthClient>;
  findById: (id: string) => Promise<PublicOAuthClient | null>;
  listByOrganization: (organizationId: string) => Promise<PublicOAuthClient[]>;
};

export type PublicOAuthCodeRepository = {
  create: (item: PublicOAuthCode) => Promise<PublicOAuthCode>;
  findByHash: (codeHash: string) => Promise<PublicOAuthCode | null>;
  save: (item: PublicOAuthCode) => Promise<PublicOAuthCode>;
};

export type PublicWebhookEndpointRepository = {
  create: (item: PublicWebhookEndpoint) => Promise<PublicWebhookEndpoint>;
  findById: (id: string) => Promise<PublicWebhookEndpoint | null>;
  listByOrganization: (organizationId: string) => Promise<PublicWebhookEndpoint[]>;
  save: (item: PublicWebhookEndpoint) => Promise<PublicWebhookEndpoint>;
};

export type PublicWebhookDeliveryRepository = {
  create: (item: PublicWebhookDelivery) => Promise<PublicWebhookDelivery>;
  findById: (id: string) => Promise<PublicWebhookDelivery | null>;
  listByEndpoint: (endpointId: string) => Promise<PublicWebhookDelivery[]>;
  save: (item: PublicWebhookDelivery) => Promise<PublicWebhookDelivery>;
};

export type PublicApiHttp = {
  request: (input: {
    url: string;
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }) => Promise<{ status: number; text: string }>;
};
