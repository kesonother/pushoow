import { jsonOk, readJson } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { publicRefundSchema } from "@/api/public-schemas";
import { presentRefund } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    services.publicApi.assertOrg(principal!, organizationId);
    const report = await services.payments.report(services.publicApi.actorFrom(principal!));
    return jsonOk(report.refunds.map(presentRefund), { requestId });
  }, { scope: "payments:read" })(request);

export const POST = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { organizationId } = await context.params;
    const body = publicRefundSchema.parse(await readJson(request));
    const services = getServices();
    services.publicApi.assertOrg(principal!, organizationId);
    const refund = await services.payments.refundOrder(services.publicApi.actorFrom(principal!), body);
    return jsonOk(presentRefund(refund), { status: 201, requestId });
  }, { scope: "refunds:write" })(request);

export const OPTIONS = publicOptions();
