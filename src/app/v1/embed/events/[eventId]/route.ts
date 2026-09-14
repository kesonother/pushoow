import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { NotFoundError } from "@/domain/errors";
import { presentEvent, presentTicketType } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(
    async ({ requestId }) => {
      const { eventId } = await context.params;
      const services = getServices();
      const event = await services.eventRepo.findById(eventId);
      if (!event || event.deletedAt || event.visibility === "private" || event.status === "draft") {
        throw new NotFoundError("Event", eventId);
      }
      const tickets = await services.tickets.listByEvent(event.id);
      return jsonOk(
        { event: presentEvent(event), tickets: tickets.map(presentTicketType) },
        { requestId },
      );
    },
    { auth: "none" },
  )(request);

export const OPTIONS = publicOptions();
