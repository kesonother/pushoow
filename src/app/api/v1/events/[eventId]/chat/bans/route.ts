import { resolveChatActor } from "@/api/chat-actor";
import { chatBanSchema } from "@/api/chat-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const body = chatBanSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveChatActor(user!, eventId);
    const action =
      body.action === "unban"
        ? await services.chat.unbanUser(actor, eventId, body.userId, body.reason)
        : await services.chat.banUser(actor, eventId, body.userId, body.reason);
    await writeAuditLog(services.db, {
      organizationId: action.organizationId,
      actorUserId: user!.id,
      action: `chat.user.${body.action}`,
      resourceType: "event_chat_moderation",
      resourceId: action.id,
      requestId,
    });
    return jsonOk(action, { status: 201, requestId });
  })(request);
