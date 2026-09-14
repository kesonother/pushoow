import { z } from "zod";
import { requireActorPermission, resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";
import { cuidGenerator } from "@/lib/ids";

const schema = z.object({
  kind: z.enum(["speaker", "agenda", "faq"]),
  title: z.string().min(1).max(180),
  body: z.string().max(5000).nullable().optional(),
  startsAt: z.iso.datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(
    async ({ requestId }) => {
      const { eventId } = await context.params;
      return jsonOk(await getServices().eventContent.listByEvent(eventId), { requestId });
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
    const item = await services.eventContent.create({
      id: cuidGenerator.id(),
      organizationId: actor.organizationId,
      eventId,
      kind: body.kind,
      title: body.title,
      body: body.body ?? null,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      sortOrder: body.sortOrder ?? 0,
    });
    return jsonOk(item, { status: 201, requestId });
  })(request);
