import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import type { IntegrationCredentials } from "@/domain/integration/types";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string; provider: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, provider } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const body = await readJson<{ credentials?: IntegrationCredentials }>(request);
    return jsonOk(await services.integrations.connect(actor, provider, body.credentials ?? {}), { requestId });
  })(request);
