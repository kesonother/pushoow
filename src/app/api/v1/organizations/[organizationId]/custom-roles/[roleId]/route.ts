import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { CUSTOM_GRANTS } from "@/domain/rbac/grants";
import { getServices } from "@/server/container";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  grants: z.array(z.enum(CUSTOM_GRANTS)).min(1).optional(),
});

type RouteContext = {
  params: Promise<{ organizationId: string; roleId: string }>;
};

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, roleId } = await context.params;
    const body = updateSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const before = await services.customRoles.getInTenant(actor, roleId);
    const role = await services.customRoles.update(actor, roleId, body);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "custom_role.update",
      resourceType: "organization_custom_role",
      resourceId: role.id,
      before,
      after: role,
      requestId,
      ...requestAuditContext(request),
    });
    return jsonOk(role, { requestId });
  })(request);

export const DELETE = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, roleId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const before = await services.customRoles.getInTenant(actor, roleId);
    await services.customRoles.remove(actor, roleId);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "custom_role.delete",
      resourceType: "organization_custom_role",
      resourceId: roleId,
      before,
      requestId,
      ...requestAuditContext(request),
    });
    return jsonOk({ removed: true }, { requestId });
  })(request);
