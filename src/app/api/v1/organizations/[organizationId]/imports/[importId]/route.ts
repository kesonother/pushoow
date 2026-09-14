import { resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string; importId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, importId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    return jsonOk(await services.imports.get(actor, importId), { requestId });
  })(request);
