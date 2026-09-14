import { ValidationError } from "@/domain/errors";
import type { IntegrationProviderId } from "@/domain/integration/types";
import { decodeJson, encodeJson, safeEqual, signPayload } from "@/lib/token-crypto";

export type OAuthState = {
  organizationId: string;
  userId: string;
  provider: IntegrationProviderId;
  exp: number;
};

export function signOAuthState(state: OAuthState, secret: string): string {
  const payload = encodeJson(state);
  return `${payload}.${signPayload(payload, secret)}`;
}

export function verifyOAuthState(value: string, secret: string): OAuthState {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signPayload(payload, secret), signature)) {
    throw new ValidationError("Invalid OAuth state");
  }
  const state = decodeJson<OAuthState>(payload);
  if (state.exp < Date.now()) throw new ValidationError("OAuth state expired");
  return state;
}

export function authorizationUrl(input: {
  authorizeUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}): string {
  const url = new URL(input.authorizeUrl);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  if (input.scopes?.length) url.searchParams.set("scope", input.scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}
