import { jsonOk, readJson } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { publicEventUpdateSchema } from "@/api/public-schemas";
import { presentEvent } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { eventId } = await context.params;
    const services = getServices();
    const event = await services.events.getEvent(services.publicApi.actorFrom(principal!), eventId);
    return jsonOk(presentEvent(event), { requestId });
  }, { scope: "events:read" })(request);

export const PATCH = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { eventId } = await context.params;
    const body = publicEventUpdateSchema.parse(await readJson(request));
    const services = getServices();
    const event = await services.events.updateEvent(services.publicApi.actorFrom(principal!), eventId, {
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
    });
    return jsonOk(presentEvent(event), { requestId });
  }, { scope: "events:write" })(request);

export const OPTIONS = publicOptions();
