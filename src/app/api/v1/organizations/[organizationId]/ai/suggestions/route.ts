import { resolveActor } from "@/api/authorize";
import { suggestionsBodySchema } from "@/api/ai-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId, request: req }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const body = suggestionsBodySchema.parse(await readJson(req));
    const data = await services.ai.suggest(actor, body);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "ai.suggestions.generate",
      resourceType: "calendar",
      resourceId: body.calendarId,
      metadata: { providerId: data.providerId },
      requestId,
      ...requestAuditContext(req),
    });
    return jsonOk(data, { requestId });
  })(request);
