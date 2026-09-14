import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string; provider: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ requestId }) => {
      const { organizationId, provider } = await context.params;
      const services = getServices();
      const rawBody = await request.text();
      const headers = Object.fromEntries(request.headers.entries());
      return jsonOk(await services.integrations.handleWebhook(organizationId, provider, headers, rawBody), {
        requestId,
      });
    },
    { auth: "none", rateLimit: { limit: 60, windowMs: 60_000 } },
  )(request);
