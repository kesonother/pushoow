import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

const schema = z.object({
  registrationIds: z.array(z.string()).optional(),
  all: z.boolean().optional(),
  deviceId: z.string().max(80).optional(),
});

type RouteContext = { params: Promise<{ eventId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const body = schema.parse(await readJson(request));
    const services = getServices();
    const event = await services.eventRepo.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    const actor = await resolveActor(services.access, user!.id, event.organizationId, user!.emailVerified);
    const results = body.all
      ? await services.checkin.checkAllIn(actor, eventId, body.deviceId)
      : await services.checkin.bulkCheckIn(actor, {
          eventId,
          registrationIds: body.registrationIds ?? [],
          deviceId: body.deviceId,
        });
    return jsonOk(results, { requestId });
  })(request);
