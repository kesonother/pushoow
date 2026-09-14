import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { presentOrganization } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    services.publicApi.assertOrg(principal!, organizationId);
    const organization = await services.organizations.getOrganization(services.publicApi.actorFrom(principal!));
    return jsonOk(presentOrganization(organization), { requestId });
  }, { scope: "organizations:read" })(request);

export const OPTIONS = publicOptions();
