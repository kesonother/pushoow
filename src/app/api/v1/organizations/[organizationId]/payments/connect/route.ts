import { z } from "zod";
import { requireActorPermission, resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

const schema = z.object({
  email: z.string().email().optional(),
});

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = requireActorPermission(
      await resolveActor(services.access, user!.id, organizationId, user!.emailVerified),
      "finance:read",
    );
    return jsonOk(await services.payments.getConnect(actor), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const raw = await request.text();
    const body = schema.parse(raw ? JSON.parse(raw) : {});
    const services = getServices();
    const actor = requireActorPermission(
      await resolveActor(services.access, user!.id, organizationId, user!.emailVerified),
      "finance:write",
    );
    const result = await services.payments.startConnect(actor, { email: body.email ?? user?.email ?? undefined });
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "payments.connect.start",
      resourceType: "connected_account",
      resourceId: result.account.id,
      requestId,
    });
    return jsonOk(result, { requestId });
  })(request);
