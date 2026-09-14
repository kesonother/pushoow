import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(async ({ requestId }) => {
  return jsonOk(getServices().mobile.bootstrap(), { requestId });
});
