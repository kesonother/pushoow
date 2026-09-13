import {
  EnterpriseNotConfiguredError,
  type EnterpriseSsoAdapter,
  type ScimAdapter,
} from "@/domain/enterprise/types";

export function unconfiguredSsoAdapter(protocol: "saml" | "oidc"): EnterpriseSsoAdapter {
  return {
    protocol,
    isConfigured: () => false,
    async startLogin() {
      throw new EnterpriseNotConfiguredError(protocol.toUpperCase());
    },
  };
}

export const unconfiguredScimAdapter: ScimAdapter = {
  isConfigured: () => false,
  async provisionUser() {
    throw new EnterpriseNotConfiguredError("SCIM");
  },
  async deprovisionUser() {
    throw new EnterpriseNotConfiguredError("SCIM");
  },
};
