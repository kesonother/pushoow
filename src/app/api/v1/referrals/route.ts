import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(async ({ user, requestId }) => {
  const snapshot = await getServices().referrals.forOrganizer(user!.id);
  return jsonOk(snapshot, { requestId });
});
