import { jsonOk, withApi } from "@/api/handler";
import { liveness } from "@/observability/health";

export const GET = withApi(
  async ({ requestId }) => jsonOk(await liveness(), { requestId }),
  { auth: "none" },
);
