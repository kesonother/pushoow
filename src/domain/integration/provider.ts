import { ValidationError } from "@/domain/errors";
import { envValue, type IntegrationSpec } from "@/domain/integration/catalog";
import { authorizationUrl } from "@/domain/integration/oauth";
import { hasStoredSecret } from "@/domain/integration/crypto";
import type {
  IntegrationCredentials,
  IntegrationHttp,
  IntegrationProvider,
  IntegrationProviderContext,
  IntegrationSyncResult,
} from "@/domain/integration/types";

export class IntegrationError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.name = "IntegrationError";
    this.retryable = retryable;
  }
}

export function integrationNotConfigured(label: string): ValidationError {
  return new ValidationError(`${label} is not configured. Provide OAuth credentials or an API key first.`);
}

function endpointFor(spec: IntegrationSpec, objectType: string): string {
  const base = spec.apiBase ?? "https://example.invalid";
  const paths: Record<string, string> = {
    contact: "/contacts",
    account: "/accounts",
    lead: "/leads",
    deal: "/deals",
    activity: "/activities",
    attendance: "/attendance",
    event: "/events",
    message: "/messages",
  };
  return `${base}${paths[objectType] ?? `/${objectType}`}`;
}

async function callProvider(
  spec: IntegrationSpec,
  credentials: IntegrationCredentials,
  http: IntegrationHttp,
  objectType: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const token = credentials.accessToken ?? credentials.apiKey;
  if (!token && !credentials.webhookUrl) {
    throw new IntegrationError(`${spec.label} has no usable credentials`, false);
  }
  const url = credentials.webhookUrl && objectType === "message" ? credentials.webhookUrl : endpointFor(spec, objectType);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (credentials.accessToken) headers.authorization = `Bearer ${credentials.accessToken}`;
  else if (credentials.apiKey) headers.authorization = `Bearer ${credentials.apiKey}`;
  if (credentials.siteId) headers["x-site-id"] = credentials.siteId;
  const response = await http.request({ url, method: "POST", headers, body: payload });
  if (response.status >= 500) throw new IntegrationError(`${spec.label} returned ${response.status}`);
  if (response.status >= 400) {
    throw new IntegrationError(`${spec.label} rejected the payload (${response.status})`, false);
  }
  const json = response.json as { id?: string } | null;
  return json && typeof json.id === "string" ? json.id : null;
}

export function createCatalogProvider(spec: IntegrationSpec): IntegrationProvider {
  return {
    id: spec.id,
    category: spec.category,
    label: spec.label,
    authType: spec.authType,
    capabilities: spec.capabilities,
    credentialFields: spec.credentialFields,
    isConfigured() {
      if (spec.authType === "api_key") return true;
      if (spec.authType === "either") return true;
      return Boolean(envValue(spec.clientIdEnv) && envValue(spec.clientSecretEnv));
    },
    async connect(input) {
      if (spec.authType === "oauth") throw integrationNotConfigured(spec.label);
      const next: IntegrationCredentials = {};
      for (const field of spec.credentialFields) {
        const value = input.credentials[field as keyof IntegrationCredentials];
        if (typeof value !== "string" || !value.trim()) {
          throw new ValidationError(`${field} is required for ${spec.label}`);
        }
        if (field === "apiKey") next.apiKey = value.trim();
        if (field === "siteId") next.siteId = value.trim();
        if (field === "webhookUrl") next.webhookUrl = value.trim();
      }
      if (!hasStoredSecret(next)) throw new ValidationError(`Credentials are required for ${spec.label}`);
      return next;
    },
    async startOAuth(input) {
      const clientId = envValue(spec.clientIdEnv);
      if (!clientId || !spec.authorizeUrl) throw integrationNotConfigured(spec.label);
      return {
        state: input.state,
        authorizationUrl: authorizationUrl({
          authorizeUrl: spec.authorizeUrl,
          clientId,
          redirectUri: input.redirectUri,
          state: input.state,
          scopes: spec.scopes,
        }),
      };
    },
    async completeOAuth(input) {
      const clientId = envValue(spec.clientIdEnv);
      const clientSecret = envValue(spec.clientSecretEnv);
      if (!clientId || !clientSecret || !spec.tokenUrl) throw integrationNotConfigured(spec.label);
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const response = await input.http.request({
        url: spec.tokenUrl,
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (response.status >= 400) throw new IntegrationError(`${spec.label} OAuth token exchange failed`);
      const token = response.json as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        instance_url?: string;
      };
      if (!token.access_token) throw new IntegrationError(`${spec.label} did not return an access token`, false);
      return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenType: token.token_type,
        instanceUrl: token.instance_url,
        expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
      };
    },
    async disconnect() {
      return;
    },
    async sync(ctx: IntegrationProviderContext): Promise<IntegrationSyncResult> {
      if (!hasStoredSecret(ctx.credentials)) throw integrationNotConfigured(spec.label);
      const result: IntegrationSyncResult = { exported: 0, skipped: 0, errors: [] };
      for (const object of ctx.objects) {
        try {
          await callProvider(spec, ctx.credentials, ctx.http, object.type, {
            provider: spec.id,
            ...object.payload,
          });
          result.exported += 1;
        } catch (error) {
          if (error instanceof IntegrationError && error.retryable) throw error;
          result.errors.push({
            localId: object.localId,
            message: error instanceof Error ? error.message : "sync failed",
          });
        }
      }
      return result;
    },
    async handleWebhook(input) {
      const secret = input.credentials?.webhookSecret;
      if (secret) {
        const provided = input.headers["x-webhook-secret"] ?? input.headers["x-hub-signature"] ?? "";
        if (provided !== secret) throw new ValidationError("Invalid integration webhook signature");
      }
      return { ok: true };
    },
  };
}

export function defaultIntegrationHttp(): IntegrationHttp {
  return {
    async request(input) {
      const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers,
        body:
          typeof input.body === "string" || input.body == null
            ? (input.body as string | undefined)
            : JSON.stringify(input.body),
      });
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }
      return { status: response.status, json };
    },
  };
}
