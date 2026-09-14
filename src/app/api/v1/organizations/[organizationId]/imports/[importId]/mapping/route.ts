import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import type { ImportMapping } from "@/domain/import/types";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string; importId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, importId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const body = await readJson<{ mapping: ImportMapping }>(request);
    return jsonOk(await services.imports.setMapping(actor, importId, body.mapping ?? {}), { requestId });
  })(request);
