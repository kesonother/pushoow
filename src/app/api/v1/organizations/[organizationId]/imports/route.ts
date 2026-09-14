import { resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { readImportUpload } from "@/api/import-upload";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId }) => {
      const { organizationId } = await context.params;
      const services = getServices();
      const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
      const input = await readImportUpload(request);
      return jsonOk(await services.imports.upload(actor, input), { status: 201, requestId });
    },
    { rateLimit: { limit: 10, windowMs: 15 * 60 * 1000 } },
  )(request);
