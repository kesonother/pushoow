export type SsoProtocol = "saml" | "oidc";

export type SsoConnection = {
  organizationId: string;
  protocol: SsoProtocol;
  enabled: boolean;
  metadata: Record<string, unknown>;
};

export type VerifiedDomain = {
  organizationId: string;
  domain: string;
  verifiedAt: Date | null;
  autoJoin: boolean;
  autoJoinRole: "read_only" | "editor";
};

export type EnterpriseSsoAdapter = {
  protocol: SsoProtocol;
  isConfigured: () => boolean;
  startLogin: (connection: SsoConnection, relayState: string) => Promise<{ redirectUrl: string }>;
};

export type ScimAdapter = {
  isConfigured: () => boolean;
  provisionUser: (input: Record<string, unknown>) => Promise<void>;
  deprovisionUser: (externalId: string) => Promise<void>;
};

export class EnterpriseNotConfiguredError extends Error {
  constructor(integration: string) {
    super(`${integration} is not configured. Provide credentials before enabling this adapter.`);
    this.name = "EnterpriseNotConfiguredError";
  }
}
