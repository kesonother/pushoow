import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { ORGANIZATION_ROLES } from "@/domain/rbac/roles";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

const updateRoleSchema = z.object({
  role: z.enum(ORGANIZATION_ROLES),
  customRoleId: z.string().min(1).nullable().optional(),
});

type RouteContext = {
  params: Promise<{ organizationId: string; userId: string }>;
};

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, userId } = await context.params;
    const body = updateRoleSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveActor(
      services.access,
      user!.id,
      organizationId,
      user!.emailVerified,
    );
    const member = await services.members.updateMemberRole(
      actor,
      userId,
      body.role,
      body.customRoleId,
    );
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "member.role.update",
      resourceType: "organization_member",
      resourceId: member.id,
      metadata: { role: body.role, customRoleId: body.customRoleId, targetUserId: userId },
      after: { role: member.role, customRoleId: member.customRoleId },
      requestId,
      ...requestAuditContext(request),
    });
    return jsonOk(member, { requestId });
  })(request);

export const DELETE = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, userId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(
      services.access,
      user!.id,
      organizationId,
      user!.emailVerified,
    );
    await services.members.removeMember(actor, userId);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "member.remove",
      resourceType: "organization_member",
      resourceId: userId,
      requestId,
    });
    return jsonOk({ removed: true }, { requestId });
  })(request);
