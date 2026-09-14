import { quoteSchema } from "@/api/event-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ requestId }) => {
      const { eventId } = await context.params;
      const body = quoteSchema.parse(await readJson(request));
      const priced = await getServices().registrations.quote({ ...body, eventId });
      return jsonOk(priced.quote, { requestId });
    },
    { auth: "optional", rateLimit: { limit: 40, windowMs: 60_000 } },
  )(request);
