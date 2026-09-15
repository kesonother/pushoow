import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { eventId } = await context.params;
    const snapshot = await getServices().referrals.forAttendee(user!.id, eventId);
    return jsonOk(snapshot, { requestId });
  })(request);
