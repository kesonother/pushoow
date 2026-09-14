import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { ORGANIZATION_DOMAIN_KINDS } from "@/domain/enterprise/domains";
import { getServices } from "@/server/container";

const addDomainSchema = z.object({
  domain: z.string().min(3).max(120),
  kind: z.enum(ORGANIZATION_DOMAIN_KINDS).optional(),
});

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(
      services.access,
      user!.id,
      organizationId,
      user!.emailVerified,
    );
    const domains = await services.domains.listDomains(actor);
    return jsonOk(
      domains.map((domain) => {
        const { tokenHash, ...safe } = domain;
        void tokenHash;
        return safe;
      }),
      { requestId },
    );
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const body = addDomainSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveActor(
      services.access,
      user!.id,
      organizationId,
      user!.emailVerified,
    );
    const result = await services.domains.addDomain(actor, body.domain, body.kind ?? "email");
    return jsonOk(result, { status: 201, requestId });
  })(request);
