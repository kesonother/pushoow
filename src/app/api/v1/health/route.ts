import { withApi, jsonOk } from "@/api/handler";
import { liveness, publicLivenessPayload } from "@/observability/health";

export const GET = withApi(
  async ({ requestId }) => jsonOk(publicLivenessPayload(await liveness()), { requestId }),
  { auth: "none" },
);
