import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { PUBLIC_WEBHOOK_EVENTS } from "@/domain/public-api/types";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const [keys, webhooks] = await Promise.all([
      services.publicApi.listKeys(actor),
      services.publicApi.listWebhooks(actor),
    ]);
    return jsonOk({ keys, webhooks, events: PUBLIC_WEBHOOK_EVENTS }, { requestId });
  })(request);

const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("key"), name: z.string().min(1).max(80) }),
  z.object({
    type: z.literal("webhook"),
    url: z.string().url(),
    events: z.array(z.enum(PUBLIC_WEBHOOK_EVENTS)).min(1),
  }),
  z.object({
    type: z.literal("oauth"),
    name: z.string().min(1).max(80),
    redirectUris: z.array(z.string().url()).min(1),
  }),
  z.object({ type: z.literal("retry"), webhookId: z.string(), deliveryId: z.string().optional() }),
]);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const body = bodySchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    if (body.type === "key") {
      return jsonOk(await services.publicApi.createKey(actor, { name: body.name }), { status: 201, requestId });
    }
    if (body.type === "webhook") {
      return jsonOk(await services.publicApi.createWebhook(actor, body), { status: 201, requestId });
    }
    if (body.type === "oauth") {
      return jsonOk(await services.publicApi.createOAuthClient(actor, body), { status: 201, requestId });
    }
    return jsonOk(await services.publicApi.retryDelivery(actor, body.webhookId, body.deliveryId), { requestId });
  })(request);
