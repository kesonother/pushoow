import { resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { EnterpriseNotConfiguredError } from "@/domain/enterprise/types";
import { unconfiguredSsoAdapter } from "@/integrations/enterprise/unconfigured";
import { getServices } from "@/server/container";
import { ValidationError } from "@/domain/errors";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    return jsonOk(
      {
        saml: { configured: unconfiguredSsoAdapter("saml").isConfigured() },
        oidc: { configured: unconfiguredSsoAdapter("oidc").isConfigured() },
        scim: { configured: false },
      },
      { requestId },
    );
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, url }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const protocol = url.searchParams.get("protocol") === "oidc" ? "oidc" : "saml";
    try {
      return Response.json(
        await unconfiguredSsoAdapter(protocol).startLogin(
          {
            organizationId,
            protocol,
            enabled: false,
            metadata: {},
          },
          "login",
        ),
      );
    } catch (error) {
      if (error instanceof EnterpriseNotConfiguredError) {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  })(request);
