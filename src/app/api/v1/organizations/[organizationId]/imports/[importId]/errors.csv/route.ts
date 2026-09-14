import { resolveActor } from "@/api/authorize";
import { withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string; importId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, importId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const csv = await services.imports.downloadErrors(actor, importId);
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="import-${importId}-errors.csv"`,
        "cache-control": "private, no-store",
        "x-request-id": requestId,
      },
    });
  })(request);
