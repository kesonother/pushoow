import { resolveActor } from "@/api/authorize";
import { aiPolicyPatchSchema } from "@/api/ai-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    return jsonOk(await services.ai.orgPolicy(actor), { requestId });
  })(request);

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId, request: req }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const body = aiPolicyPatchSchema.parse(await readJson(req));
    const data = await services.ai.updateOrgPolicy(actor, body);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "ai.policy.update",
      resourceType: "organization",
      resourceId: actor.organizationId,
      metadata: {
        optedOut: data.optedOut,
        trainingAllowed: data.trainingAllowed,
        providerRetentionDays: data.providerRetentionDays,
      },
      requestId,
      ...requestAuditContext(req),
    });
    return jsonOk(data, { requestId });
  })(request);
