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
    const actor = await resolveActor(
      services.memberships,
      user!.id,
      organizationId,
      user!.emailVerified,
    );
    const members = await services.members.listMembers(actor);
    return jsonOk(paginateById(members, parsePageQuery(url.searchParams)), { requestId });
  })(request);
