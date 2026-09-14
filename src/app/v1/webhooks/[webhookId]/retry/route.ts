import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ webhookId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { webhookId } = await context.params;
    const services = getServices();
    const retried = await services.publicApi.retryDelivery(services.publicApi.actorFrom(principal!), webhookId);
    return jsonOk(retried, { requestId });
  }, { scope: "webhooks:manage" })(request);

export const OPTIONS = publicOptions();
