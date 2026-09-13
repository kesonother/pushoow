import { describe, expect, it } from "vitest";
import { EnterpriseNotConfiguredError } from "@/domain/enterprise/types";
import {
  unconfiguredScimAdapter,
  unconfiguredSsoAdapter,
} from "@/integrations/enterprise/unconfigured";

describe("enterprise adapters", () => {
  it("does not pretend SAML, OIDC or SCIM are connected", async () => {
    expect(unconfiguredSsoAdapter("saml").isConfigured()).toBe(false);
    expect(unconfiguredSsoAdapter("oidc").isConfigured()).toBe(false);
    expect(unconfiguredScimAdapter.isConfigured()).toBe(false);
    await expect(
      unconfiguredSsoAdapter("saml").startLogin(
        { organizationId: "org_1", protocol: "saml", enabled: false, metadata: {} },
        "x",
      ),
    ).rejects.toBeInstanceOf(EnterpriseNotConfiguredError);
  });
});
