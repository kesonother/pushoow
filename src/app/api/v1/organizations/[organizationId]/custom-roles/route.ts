import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { CUSTOM_GRANTS } from "@/domain/rbac/grants";
import { getServices } from "@/server/container";

const roleSchema = z.object({
  name: z.string().min(2).max(80),
  grants: z.array(z.enum(CUSTOM_GRANTS)).min(1),
});

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    return jsonOk(await services.customRoles.list(actor), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const body = roleSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const role = await services.customRoles.create(actor, body);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "custom_role.create",
      resourceType: "organization_custom_role",
      resourceId: role.id,
      after: role,
      requestId,
      ...requestAuditContext(request),
    });
    return jsonOk(role, { status: 201, requestId });
  })(request);
