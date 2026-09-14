import { jsonOk, readJson } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { publicWebhookSchema } from "@/api/public-schemas";
import { getServices } from "@/server/container";

export const GET = withPublicApi(async ({ principal, requestId }) => {
  const services = getServices();
  return jsonOk(await services.publicApi.listWebhooks(services.publicApi.actorFrom(principal!)), { requestId });
}, { scope: "webhooks:manage" });

export const POST = withPublicApi(async ({ principal, request, requestId }) => {
  const body = publicWebhookSchema.parse(await readJson(request));
  const services = getServices();
  const created = await services.publicApi.createWebhook(services.publicApi.actorFrom(principal!), body);
  return jsonOk(created, { status: 201, requestId });
}, { scope: "webhooks:manage" });

export const OPTIONS = publicOptions();
