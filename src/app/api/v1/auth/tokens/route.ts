import { jsonOk, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

export const POST = withApi(
  async ({ user, requestId }) => {
    const services = getServices();
    const pair = await services.tokens.issue(user!.id);
    await writeAuditLog(services.db, {
      actorUserId: user!.id,
      action: "session.issue",
      resourceType: "refresh_token",
      resourceId: pair.familyId,
      requestId,
    });
    return jsonOk(pair, { status: 201, requestId });
  },
  { rateLimit: { limit: 10, windowMs: 60_000 } },
);
