import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { presentPayment } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    services.publicApi.assertOrg(principal!, organizationId);
    const report = await services.payments.report(services.publicApi.actorFrom(principal!));
    return jsonOk(report.payments.map(presentPayment), { requestId });
  }, { scope: "payments:read" })(request);

export const OPTIONS = publicOptions();
