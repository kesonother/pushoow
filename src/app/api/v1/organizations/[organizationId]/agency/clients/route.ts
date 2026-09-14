import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

const createClientSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).optional(),
});

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    return jsonOk(await services.agency.listClients(actor), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const body = createClientSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const client = await services.agency.createClient(actor, body);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "agency.client.create",
      resourceType: "organization",
      resourceId: client.id,
      after: {
        clientId: client.id,
        branding: { logoUrl: client.logoUrl, primaryColor: client.primaryColor },
        billingMode: client.billingMode,
        billingOrganizationId: client.billingOrganizationId,
      },
      requestId,
      ...requestAuditContext(request),
    });
    return jsonOk(client, { status: 201, requestId });
  })(request);
