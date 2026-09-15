import { resolveActor } from "@/api/authorize";
import { descriptionBodySchema } from "@/api/ai-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId, request: req }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const body = descriptionBodySchema.parse(await readJson(req));
    const data = await services.ai.generateDescription(actor, {
      title: body.title,
      tags: body.tags ?? [],
      location: body.location ?? null,
      format: body.format ?? "in-person",
      persona: body.persona ?? "neutral",
      providerId: body.providerId,
    });
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "ai.description.generate",
      resourceType: "ai_generation",
      metadata: { persona: body.persona ?? "neutral", providerId: data.providerId },
      requestId,
      ...requestAuditContext(req),
    });
    return jsonOk(data, { requestId, status: 201 });
  })(request);
