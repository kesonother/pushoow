import { resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const organization = await services.agency.convertToAgency(actor);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "agency.convert",
      resourceType: "organization",
      resourceId: organization.id,
      after: { kind: organization.kind },
      requestId,
      ...requestAuditContext(request),
    });
    return jsonOk(organization, { requestId });
  })(request);
