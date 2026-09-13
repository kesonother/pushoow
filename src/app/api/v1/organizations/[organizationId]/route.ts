import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(80).optional(),
});

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.memberships, user!.id, organizationId);
    const organization = await services.organizations.getOrganization(actor);
    return jsonOk(organization, { requestId });
  })(request);

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const body = updateOrganizationSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveActor(services.memberships, user!.id, organizationId);
    const organization = await services.organizations.updateOrganization(actor, body);

    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "organization.update",
      resourceType: "organization",
      resourceId: organization.id,
      metadata: body,
      requestId,
    });

    return jsonOk(organization, { requestId });
  })(request);
