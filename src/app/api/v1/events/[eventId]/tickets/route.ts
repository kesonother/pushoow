import { z } from "zod";
import { requireActorPermission, resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { normalizeCurrency } from "@/domain/payments/currencies";
import { getServices } from "@/server/container";
import { cuidGenerator } from "@/lib/ids";

const schema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).nullable().optional(),
  priceCents: z.number().int().min(0),
  currency: z.string().min(3).max(8).optional(),
  capacity: z.number().int().positive().nullable().optional(),
  salesStart: z.iso.datetime().nullable().optional(),
  salesEnd: z.iso.datetime().nullable().optional(),
  visibility: z.enum(["public", "unlisted", "members"]).optional(),
});

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(
    async ({ requestId }) => {
      const { eventId } = await context.params;
      const tickets = await getServices().tickets.listByEvent(eventId);
      return jsonOk(tickets, { requestId });
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
    const ticket = await services.tickets.create({
      id: cuidGenerator.id(),
      organizationId: actor.organizationId,
      eventId,
      name: body.name,
      description: body.description ?? null,
      priceCents: body.priceCents,
      currency: normalizeCurrency(body.currency ?? "EUR"),
      capacity: body.capacity ?? null,
      salesStart: body.salesStart ? new Date(body.salesStart) : null,
      salesEnd: body.salesEnd ? new Date(body.salesEnd) : null,
      visibility: body.visibility ?? "public",
      createdAt: now,
      updatedAt: now,
    });
    return jsonOk(ticket, { status: 201, requestId });
  })(request);
