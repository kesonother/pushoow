import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import {
  SUPPORT_CHANNELS,
  TICKET_PRIORITIES,
} from "@/domain/support/types";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

const attachmentSchema = z.object({
  id: z.string().min(1).optional(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  url: z.string().url(),
});

const createSchema = z.object({
  subject: z.string().min(3).max(160),
  body: z.string().min(1).max(8_000),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  channel: z.enum(SUPPORT_CHANNELS).optional(),
  requesterEmail: z.string().email().optional(),
  channelMetadata: z
    .object({
      emailFrom: z.string().optional(),
      emailMessageId: z.string().optional(),
      phoneNumber: z.string().optional(),
      callSid: z.string().optional(),
      slackTeamId: z.string().optional(),
      slackChannelId: z.string().optional(),
      slackThreadTs: z.string().optional(),
    })
    .optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    return jsonOk(await services.support.listTickets(actor), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId, request: req }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const body = createSchema.parse(await readJson(req));
    const conversation = await services.support.createTicket(actor, body);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "support.ticket.create",
      resourceType: "support_ticket",
      resourceId: conversation.ticket.id,
      metadata: { number: conversation.ticket.number, channel: conversation.ticket.channel },
      requestId,
      ...requestAuditContext(req),
    });
    return jsonOk(conversation, { requestId, status: 201 });
  })(request);
