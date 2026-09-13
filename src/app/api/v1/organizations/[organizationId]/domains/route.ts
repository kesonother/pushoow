import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

const addDomainSchema = z.object({
  domain: z.string().min(3).max(120),
});

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const body = addDomainSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveActor(
      services.memberships,
      user!.id,
      organizationId,
      user!.emailVerified,
    );
    const result = await services.domains.addDomain(actor, body.domain);
    return jsonOk(result, { status: 201, requestId });
  })(request);
