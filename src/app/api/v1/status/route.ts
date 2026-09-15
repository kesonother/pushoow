import { jsonOk, withApi } from "@/api/handler";
import { unavailablePublicStatus } from "@/domain/support/service";
import { enrichPublicStatus } from "@/observability/status-page";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ requestId }) => {
    try {
      return jsonOk(await enrichPublicStatus(await getServices().support.publicStatus()), { requestId });
    } catch {
      return jsonOk(await enrichPublicStatus(unavailablePublicStatus()), { requestId });
    }
  },
  { auth: "none", rateLimit: { limit: 60, windowMs: 60_000 } },
);
