import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

const schema = z.object({
  deviceId: z.string().max(80).optional(),
  checkIns: z.array(
    z.object({
      clientOpId: z.string().min(4).max(120),
      registrationId: z.string().optional(),
      token: z.string().optional(),
      ticketCode: z.string().optional(),
      checkedInAt: z.iso.datetime(),
    }),
  ),
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
    return jsonOk(await services.checkin.sync(actor, { eventId, ...body }), { requestId });
  })(request);
