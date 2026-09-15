import { resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string; eventId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId, request: req }) => {
    const { organizationId, eventId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const data = await services.ai.recap(actor, eventId);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "ai.recap.generate",
      resourceType: "event",
      resourceId: eventId,
      metadata: { providerId: data.providerId, demographics: data.demographics.reason },
      requestId,
      ...requestAuditContext(req),
    });
    return jsonOk(data, { requestId, status: 201 });
  })(request);
