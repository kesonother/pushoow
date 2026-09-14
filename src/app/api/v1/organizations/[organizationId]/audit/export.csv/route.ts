import { resolveActor } from "@/api/authorize";
import { withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const csv = await services.audit.exportCsv(actor);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="audit-${organizationId}.csv"`,
      },
    });
  })(request);
