import { resolveChatActor } from "@/api/chat-actor";
import { chatModerateSchema } from "@/api/chat-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string; messageId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId, messageId } = await context.params;
    const body = chatModerateSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveChatActor(user!, eventId);
    const message =
      body.action === "hard_delete"
        ? await services.chat.hardDelete(actor, eventId, messageId, body.reason ?? "Hard delete")
        : await services.chat.softDelete(actor, eventId, messageId, body.reason ?? "Deleted");
    await writeAuditLog(services.db, {
      organizationId: message.organizationId,
      actorUserId: user!.id,
      action: `chat.message.${body.action}`,
      resourceType: "event_chat_message",
      resourceId: message.id,
      requestId,
    });
    return jsonOk(message, { requestId });
  })(request);
