import { resolveChatActor } from "@/api/chat-actor";
import { chatThreadSchema } from "@/api/chat-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const actor = await resolveChatActor(user!, eventId);
    return jsonOk(await getServices().chat.listThreads(actor, eventId), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const body = chatThreadSchema.parse(await readJson(request));
    const actor = await resolveChatActor(user!, eventId);
    const thread = await getServices().chat.createThread(actor, eventId, body.title);
    return jsonOk(thread, { status: 201, requestId });
  })(request);
