import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { presentPayment } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

export const GET = withPublicApi(async ({ principal, requestId }) => {
  const services = getServices();
  const report = await services.payments.report(services.publicApi.actorFrom(principal!));
  return jsonOk(report.payments.map(presentPayment), { requestId });
}, { scope: "payments:read" });

export const OPTIONS = publicOptions();
