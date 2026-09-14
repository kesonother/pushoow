import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { ValidationError } from "@/domain/errors";
import { MESSAGE_VISIBILITIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/domain/support/types";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string; ticketId: string }> };

const attachmentSchema = z.object({
  id: z.string().min(1).optional(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  url: z.string().url(),
});

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, ticketId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    return jsonOk(await services.support.getConversation(actor, ticketId), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId, url, request: req }) => {
    const { organizationId, ticketId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const action = url.searchParams.get("action") ?? "reply";

    if (action === "reply") {
      const body = z
        .object({
          body: z.string().min(1).max(8_000),
          visibility: z.enum(MESSAGE_VISIBILITIES).optional(),
          authorKind: z.enum(["requester", "agent"]).optional(),
          attachments: z.array(attachmentSchema).max(10).optional(),
        })
        .parse(await readJson(req));
      const conversation = await services.support.addMessage(actor, ticketId, body);
      await writeAuditLog(services.db, {
        organizationId: actor.organizationId,
        actorUserId: user!.id,
        action: "support.ticket.reply",
        resourceType: "support_ticket",
        resourceId: ticketId,
        requestId,
        ...requestAuditContext(req),
      });
      return jsonOk(conversation, { requestId });
    }

    if (action === "assign") {
      const body = z.object({ assigneeUserId: z.string().min(1) }).parse(await readJson(req));
      const conversation = await services.support.assign(actor, ticketId, body.assigneeUserId);
      await writeAuditLog(services.db, {
        organizationId: actor.organizationId,
        actorUserId: user!.id,
        action: "support.ticket.assign",
        resourceType: "support_ticket",
        resourceId: ticketId,
        metadata: { assigneeUserId: body.assigneeUserId },
        requestId,
        ...requestAuditContext(req),
      });
      return jsonOk(conversation, { requestId });
    }

    if (action === "status") {
      const body = z.object({ status: z.enum(TICKET_STATUSES) }).parse(await readJson(req));
      const conversation = await services.support.setStatus(actor, ticketId, body.status);
      await writeAuditLog(services.db, {
        organizationId: actor.organizationId,
        actorUserId: user!.id,
        action: "support.ticket.status",
        resourceType: "support_ticket",
        resourceId: ticketId,
        metadata: { status: body.status },
        requestId,
        ...requestAuditContext(req),
      });
      return jsonOk(conversation, { requestId });
    }

    if (action === "priority") {
      const body = z.object({ priority: z.enum(TICKET_PRIORITIES) }).parse(await readJson(req));
      const conversation = await services.support.setPriority(actor, ticketId, body.priority);
      return jsonOk(conversation, { requestId });
    }

    throw new ValidationError("Unknown support action");
  })(request);
