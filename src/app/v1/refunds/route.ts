import { jsonOk, readJson } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { publicRefundSchema } from "@/api/public-schemas";
import { presentRefund } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

export const GET = withPublicApi(async ({ principal, requestId }) => {
  const services = getServices();
  const report = await services.payments.report(services.publicApi.actorFrom(principal!));
  return jsonOk(report.refunds.map(presentRefund), { requestId });
}, { scope: "payments:read" });

export const POST = withPublicApi(async ({ principal, request, requestId }) => {
  const body = publicRefundSchema.parse(await readJson(request));
  const services = getServices();
  const refund = await services.payments.refundOrder(services.publicApi.actorFrom(principal!), body);
  return jsonOk(presentRefund(refund), { status: 201, requestId });
}, { scope: "refunds:write" });

export const OPTIONS = publicOptions();
