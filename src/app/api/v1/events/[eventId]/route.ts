import { resolveActor } from "@/api/authorize";
import { eventWriteSchema } from "@/api/event-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

async function actorForEvent(userId: string, eventId: string, emailVerified = false) {
  const services = getServices();
  const event = await services.eventRepo.findById(eventId);
  if (!event || event.deletedAt) {
    throw new NotFoundError("Event", eventId);
  }
  const actor = await resolveActor(
    services.access,
    userId,
    event.organizationId,
    emailVerified,
  );
  return { services, actor };
}

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const { services, actor } = await actorForEvent(user!.id, eventId, user!.emailVerified);
    const event = await services.events.getEvent(actor, eventId);
    return jsonOk(event, { requestId });
  })(request);

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const body = eventWriteSchema.parse(await readJson(request));
    const { services, actor } = await actorForEvent(user!.id, eventId, user!.emailVerified);
    const event = await services.events.updateEvent(actor, eventId, {
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
    });
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "event.update",
      resourceType: "event",
      resourceId: event.id,
      metadata: body,
      requestId,
    });
    return jsonOk(event, { requestId });
  })(request);
