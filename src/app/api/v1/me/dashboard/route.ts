import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(async ({ user, requestId }) => {
  const home = await getServices().analytics.attendeeHome(user!.id, user!.email);
  return jsonOk(home, { requestId });
});
