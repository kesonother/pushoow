import { resolveActor } from "@/api/authorize";
import { recurrenceSchema } from "@/api/event-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const services = getServices();
    const event = await services.eventRepo.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    await resolveActor(services.access, user!.id, event.organizationId);
    return jsonOk(await services.events.listOccurrences(eventId), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const body = recurrenceSchema.parse(await readJson(request));
    const services = getServices();
    const event = await services.eventRepo.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    const actor = await resolveActor(services.access, user!.id, event.organizationId);
    const rule = await services.events.setRecurrence(actor, eventId, {
      ...body,
      until: body.until ? new Date(body.until) : null,
    });
    return jsonOk(rule, { requestId });
  })(request);
