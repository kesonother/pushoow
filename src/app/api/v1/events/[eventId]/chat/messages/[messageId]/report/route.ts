import { resolveChatActor } from "@/api/chat-actor";
import { chatReportSchema } from "@/api/chat-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string; messageId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId, messageId } = await context.params;
    const body = chatReportSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveChatActor(user!, eventId);
    const report = await services.chat.reportMessage(actor, eventId, messageId, body.reason);
    await writeAuditLog(services.db, {
      organizationId: report.organizationId,
      actorUserId: user!.id,
      action: "chat.message.report",
      resourceType: "event_chat_report",
      resourceId: report.id,
      requestId,
    });
    return jsonOk(report, { status: 201, requestId });
  })(request);
