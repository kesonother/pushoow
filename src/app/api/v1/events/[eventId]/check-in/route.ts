import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

const schema = z.object({
  token: z.string().optional(),
  registrationId: z.string().optional(),
  ticketCode: z.string().optional(),
  email: z.string().email().optional(),
  clientOpId: z.string().min(4).max(120),
  deviceId: z.string().max(80).optional(),
  source: z.enum(["scan", "search", "bulk", "walk_in", "sync"]).optional(),
  checkedInAt: z.iso.datetime().optional(),
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
    const result = await services.checkin.checkIn(actor, {
      ...body,
      eventId,
      checkedInAt: body.checkedInAt ? new Date(body.checkedInAt) : undefined,
    });
    return jsonOk(result, { requestId });
  })(request);
