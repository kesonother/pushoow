export const INTEGRATION_CATEGORIES = [
  "crm",
  "marketing",
  "productivity",
  "video",
  "calendar",
] as const;
export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export const INTEGRATION_PROVIDER_IDS = [
  "hubspot",
  "salesforce",
  "pipedrive",
  "mailchimp",
  "klaviyo",
  "customerio",
  "notion",
  "slack",
  "discord",
  "zoom",
  "google_meet",
  "microsoft_teams",
  "youtube",
  "vimeo",
  "google_calendar",
  "outlook",
] as const;
export type IntegrationProviderId = (typeof INTEGRATION_PROVIDER_IDS)[number];

export const INTEGRATION_CAPABILITIES = [
  "contacts",
  "accounts",
  "leads",
  "deals",
  "activities",
  "attendance",
  "registrant.created",
  "registrant.updated",
  "check_in",
  "cancellation",
  "messages",
  "pages",
  "meetings",
  "streams",
  "calendar.sync",
] as const;
export type IntegrationCapability = (typeof INTEGRATION_CAPABILITIES)[number];

export const INTEGRATION_STATUSES = ["disconnected", "pending", "connected", "error"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const INTEGRATION_AUTH_TYPES = ["oauth", "api_key", "either"] as const;
export type IntegrationAuthType = (typeof INTEGRATION_AUTH_TYPES)[number];

export type IntegrationCredentials = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType?: string;
  apiKey?: string;
  siteId?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  instanceUrl?: string;
  extra?: Record<string, string>;
};

export type IntegrationConnection = {
  id: string;
  organizationId: string;
  provider: IntegrationProviderId;
  status: IntegrationStatus;
  ciphertext: string;
  scopes: string[];
  externalAccountId: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type IntegrationConnectionView = Omit<IntegrationConnection, "ciphertext"> & {
  category: IntegrationCategory;
  label: string;
  authType: IntegrationAuthType;
  capabilities: IntegrationCapability[];
  configured: boolean;
  connected: boolean;
  credentialFields: string[];
};

export type IntegrationExternalRef = {
  id: string;
  organizationId: string;
  provider: IntegrationProviderId;
  objectType: string;
  localId: string;
  externalId: string;
  updatedAt: Date;
};

export type IntegrationDomainEvent =
  | {
      type: "registrant.created" | "registrant.updated" | "check_in";
      organizationId: string;
      eventId: string;
      registrationId: string;
      email: string;
      status: string;
    }
  | {
      type: "cancellation";
      organizationId: string;
      eventId: string;
      registrationId?: string;
      email?: string;
    }
  | {
      type: "event.upsert" | "event.cancelled";
      organizationId: string;
      eventId: string;
    };

export type IntegrationSyncObject = {
  type: "contact" | "account" | "lead" | "deal" | "activity" | "attendance" | "event" | "message";
  localId: string;
  payload: Record<string, unknown>;
};

export type IntegrationSyncResult = {
  exported: number;
  skipped: number;
  errors: Array<{ localId: string; message: string }>;
};

export type IntegrationHttp = {
  request: (input: {
    url: string;
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
  }) => Promise<{ status: number; json: unknown }>;
};

export type IntegrationProviderContext = {
  organizationId: string;
  connection: IntegrationConnection;
  credentials: IntegrationCredentials;
  objects: IntegrationSyncObject[];
  event?: IntegrationDomainEvent;
  http: IntegrationHttp;
};

export type IntegrationProvider = {
  id: IntegrationProviderId;
  category: IntegrationCategory;
  label: string;
  authType: IntegrationAuthType;
  capabilities: IntegrationCapability[];
  credentialFields: string[];
  isConfigured: () => boolean;
  connect: (input: {
    organizationId: string;
    credentials: IntegrationCredentials;
  }) => Promise<IntegrationCredentials>;
  startOAuth: (input: { redirectUri: string; state: string }) => Promise<{
    authorizationUrl: string;
    state: string;
  }>;
  completeOAuth: (input: {
    code: string;
    redirectUri: string;
    http: IntegrationHttp;
  }) => Promise<IntegrationCredentials>;
  disconnect: (ctx: Pick<IntegrationProviderContext, "credentials" | "http">) => Promise<void>;
  sync: (ctx: IntegrationProviderContext) => Promise<IntegrationSyncResult>;
  handleWebhook: (input: {
    headers: Record<string, string>;
    rawBody: string;
    credentials: IntegrationCredentials | null;
  }) => Promise<{ ok: boolean; event?: IntegrationDomainEvent }>;
};

export type IntegrationConnectionRepository = {
  create: (item: IntegrationConnection) => Promise<IntegrationConnection>;
  findById: (id: string) => Promise<IntegrationConnection | null>;
  findByProvider: (
    organizationId: string,
    provider: IntegrationProviderId,
  ) => Promise<IntegrationConnection | null>;
  listByOrganization: (organizationId: string) => Promise<IntegrationConnection[]>;
  save: (item: IntegrationConnection) => Promise<IntegrationConnection>;
  delete: (id: string) => Promise<void>;
};

export type IntegrationRefRepository = {
  find: (
    organizationId: string,
    provider: IntegrationProviderId,
    objectType: string,
    localId: string,
  ) => Promise<IntegrationExternalRef | null>;
  save: (item: IntegrationExternalRef) => Promise<IntegrationExternalRef>;
};

export type IntegrationEmitter = {
  emit: (event: IntegrationDomainEvent) => Promise<void>;
};
