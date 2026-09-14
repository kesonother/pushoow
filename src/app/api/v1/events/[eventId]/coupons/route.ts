import { z } from "zod";
import { requireActorPermission, resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";
import { cuidGenerator } from "@/lib/ids";

const schema = z.object({
  code: z.string().min(2).max(40),
  kind: z.enum(["percentage", "fixed"]),
  amount: z.number().int().positive(),
  usageLimit: z.number().int().positive().nullable().optional(),
  startsAt: z.iso.datetime().nullable().optional(),
  endsAt: z.iso.datetime().nullable().optional(),
});

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const services = getServices();
    const event = await services.eventRepo.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    requireActorPermission(
      await resolveActor(services.access, user!.id, event.organizationId),
      "organization:read",
    );
    return jsonOk(await services.coupons.listByEvent(eventId), { requestId });
  })(request);

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
    const coupon = await services.coupons.create({
      id: cuidGenerator.id(),
      organizationId: actor.organizationId,
      eventId,
      code: body.code.trim().toUpperCase(),
      kind: body.kind,
      amount: body.amount,
      usageLimit: body.usageLimit ?? null,
      usedCount: 0,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      createdAt: now,
      updatedAt: now,
    });
    return jsonOk(coupon, { status: 201, requestId });
  })(request);
