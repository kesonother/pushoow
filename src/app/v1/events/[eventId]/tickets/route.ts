import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { presentTicketType } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { eventId } = await context.params;
    const services = getServices();
    await services.events.getEvent(services.publicApi.actorFrom(principal!), eventId);
    const tickets = await services.tickets.listByEvent(eventId);
    return jsonOk(tickets.map(presentTicketType), { requestId });
  }, { scope: "tickets:read" })(request);

export const OPTIONS = publicOptions();
