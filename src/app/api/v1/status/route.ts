import { jsonOk, withApi } from "@/api/handler";
import { unavailablePublicStatus } from "@/domain/support/service";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ requestId }) => {
    try {
      return jsonOk(await getServices().support.publicStatus(), { requestId });
    } catch {
      return jsonOk(unavailablePublicStatus(), { requestId });
    }
  },
  { auth: "none", rateLimit: { limit: 60, windowMs: 60_000 } },
);
