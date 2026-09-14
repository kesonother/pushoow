import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { postponeSchema } from "@/api/event-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

const schema = z.object({
  action: z.enum(["cancel", "postpone"]),
}).and(postponeSchema.partial());

type RouteContext = { params: Promise<{ eventId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const body = schema.parse(await readJson(request));
    const services = getServices();
    const event = await services.eventRepo.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    const actor = await resolveActor(
      services.access,
      user!.id,
      event.organizationId,
      user!.emailVerified,
    );
    const updated =
      body.action === "cancel"
        ? await services.events.cancelEvent(actor, eventId)
        : await services.events.postponeEvent(actor, eventId, {
            startsAt: new Date(body.startsAt!),
            endsAt: new Date(body.endsAt!),
          });
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: `event.${body.action}`,
      resourceType: "event",
      resourceId: updated.id,
      requestId,
    });
    return jsonOk(updated, { requestId });
  })(request);
