import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getEnv } from "@/lib/env";
import { getServices } from "@/server/container";

const schema = z.object({
  email: z.string().email(),
  ticketTypeId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
});

type RouteContext = { params: Promise<{ eventId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId, url }) => {
    const { eventId } = await context.params;
    const body = schema.parse(await readJson(request));
    const services = getServices();
    const event = await services.eventRepo.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    const actor = await resolveActor(services.access, user!.id, event.organizationId, user!.emailVerified);
    const origin = getEnv().APP_URL ?? url.origin;
    return jsonOk(
      await services.checkin.walkIn(actor, {
        ...body,
        eventId,
        successUrl: `${origin}/check-in/${eventId}?walkin=1`,
        cancelUrl: `${origin}/check-in/${eventId}?walkin=0`,
      }),
      { status: 201, requestId },
    );
  })(request);
