import { jsonOk, withApi } from "@/api/handler";
import { readiness } from "@/observability/health";

export const GET = withApi(
  async ({ requestId }) => {
    const report = await readiness();
    return jsonOk(report, { status: report.ready ? 200 : 503, requestId });
  },
  { auth: "none" },
);
