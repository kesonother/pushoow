import { z } from "zod";
import { requireActorPermission, resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

const schema = z.object({
  amountCents: z.number().int().positive().optional(),
  issuedTicketId: z.string().optional(),
  reason: z.string().min(2).max(240),
});

type RouteContext = { params: Promise<{ organizationId: string; orderId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId, orderId } = await context.params;
    const body = schema.parse(await readJson(request));
    const services = getServices();
    const actor = requireActorPermission(
      await resolveActor(services.access, user!.id, organizationId, user!.emailVerified),
      "finance:write",
    );
    const refund = await services.payments.refundOrder(actor, { orderId, ...body });
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "payments.refund",
      resourceType: "order",
      resourceId: orderId,
      metadata: { kind: refund.kind, amountCents: refund.amountCents, reason: refund.reason },
      requestId,
    });
    return jsonOk(refund, { status: 201, requestId });
  })(request);
