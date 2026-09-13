import { resolveChatActor } from "@/api/chat-actor";
import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const actor = await resolveChatActor(user!, eventId);
    return jsonOk(await getServices().chat.listReports(actor, eventId), { requestId });
  })(request);
