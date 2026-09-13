import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

const acceptSchema = z.object({
  token: z.string().min(10),
});

export const POST = withApi(
  async ({ user, request, requestId }) => {
    const body = acceptSchema.parse(await readJson(request));
    const services = getServices();
    const member = await services.members.acceptInvitation({
      token: body.token,
      actorUserId: user!.id,
    });
    await writeAuditLog(services.db, {
      organizationId: member.organizationId,
      actorUserId: user!.id,
      action: "member.invite.accept",
      resourceType: "organization_member",
      resourceId: member.id,
      requestId,
    });
    return jsonOk(member, { requestId });
  },
  { rateLimit: { limit: 10, windowMs: 60_000 } },
);
