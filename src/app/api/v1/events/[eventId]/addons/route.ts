import { z } from "zod";
import { requireActorPermission, resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { normalizeCurrency } from "@/domain/payments/currencies";
import { getServices } from "@/server/container";
import { cuidGenerator } from "@/lib/ids";

const schema = z.object({
  name: z.string().min(2).max(80),
  priceCents: z.number().int().min(0),
  currency: z.string().min(3).max(8).optional(),
  capacity: z.number().int().positive().nullable().optional(),
  inventory: z.number().int().min(0).nullable().optional(),
});

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(
    async ({ requestId }) => {
      const { eventId } = await context.params;
      return jsonOk(await getServices().addOns.listByEvent(eventId), { requestId });
    },
    { auth: "optional" },
  )(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const body = schema.parse(await readJson(request));
    const services = getServices();
    const event = await services.eventRepo.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    const actor = requireActorPermission(
      await resolveActor(services.access, user!.id, event.organizationId),
      "events:update",
    );
    const now = new Date();
    const addOn = await services.addOns.create({
      id: cuidGenerator.id(),
      organizationId: actor.organizationId,
      eventId,
      name: body.name,
      priceCents: body.priceCents,
      currency: normalizeCurrency(body.currency ?? "EUR"),
      capacity: body.capacity ?? null,
      inventory: body.inventory ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return jsonOk(addOn, { status: 201, requestId });
  })(request);
