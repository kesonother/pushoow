import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(async ({ user, requestId }) => {
  return jsonOk(await getServices().mobile.widget(user!.id, user!.email), { requestId });
});
