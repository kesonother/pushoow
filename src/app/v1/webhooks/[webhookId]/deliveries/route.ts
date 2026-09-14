import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ webhookId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { webhookId } = await context.params;
    const services = getServices();
    const deliveries = await services.publicApi.listDeliveries(
      services.publicApi.actorFrom(principal!),
      webhookId,
    );
    return jsonOk(deliveries, { requestId });
  }, { scope: "webhooks:manage" })(request);

export const OPTIONS = publicOptions();
