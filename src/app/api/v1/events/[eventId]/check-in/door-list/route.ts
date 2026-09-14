import { resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const services = getServices();
    const event = await services.eventRepo.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    const actor = await resolveActor(services.access, user!.id, event.organizationId, user!.emailVerified);
    return jsonOk(await services.checkin.doorList(actor, eventId), { requestId });
  })(request);
