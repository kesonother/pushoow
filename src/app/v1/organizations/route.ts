import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { presentOrganization } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

export const GET = withPublicApi(async ({ principal, requestId }) => {
  const services = getServices();
  const organization = await services.organizations.getOrganization(services.publicApi.actorFrom(principal!));
  return jsonOk([presentOrganization(organization)], { requestId });
}, { scope: "organizations:read" });

export const OPTIONS = publicOptions();
