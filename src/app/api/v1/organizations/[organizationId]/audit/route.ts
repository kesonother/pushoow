import { resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { paginateById, parsePageQuery } from "@/api/pagination";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, url, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const logs = await services.audit.list(actor);
    return jsonOk(paginateById(logs, parsePageQuery(url.searchParams)), { requestId });
  })(request);
