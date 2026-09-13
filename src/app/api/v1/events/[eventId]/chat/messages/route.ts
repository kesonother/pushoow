import { resolveChatActor } from "@/api/chat-actor";
import { chatMessageSchema } from "@/api/chat-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, url, requestId }) => {
    const { eventId } = await context.params;
    const actor = await resolveChatActor(user!, eventId);
    const before = url.searchParams.get("cursor") ?? url.searchParams.get("beforeSeq");
    const after = url.searchParams.get("afterSeq");
    const page = await getServices().chat.listMessages(actor, eventId, {
      threadId: url.searchParams.get("threadId") ?? undefined,
      beforeSeq: before ? Number(before) : undefined,
      afterSeq: after ? Number(after) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 30,
    });
    return jsonOk(page, { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId }) => {
      const { eventId } = await context.params;
      const body = chatMessageSchema.parse(await readJson(request));
      const services = getServices();
      const actor = await resolveChatActor(user!, eventId);
      const message = await services.chat.postMessage(actor, eventId, body);
      await writeAuditLog(services.db, {
        organizationId: message.organizationId,
        actorUserId: user!.id,
        action: "chat.message.create",
        resourceType: "event_chat_message",
        resourceId: message.id,
        requestId,
      });
      return jsonOk(message, { status: 201, requestId });
    },
    { rateLimit: { limit: 40, windowMs: 60_000 } },
  )(request);
