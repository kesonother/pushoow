import { jsonOk, withApi } from "@/api/handler";
import { getEnv } from "@/lib/env";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ calendarId: string; membershipId: string }>;
};

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId, membershipId } = await context.params;
    const origin = getEnv().APP_URL ?? new URL(request.url).origin;
    const result = await getServices().calendarMemberships.startPayment(user!.id, membershipId, {
      successUrl: `${origin}/c/${calendarId}?paid=1`,
      cancelUrl: `${origin}/c/${calendarId}?paid=0`,
    });
    return jsonOk(result, { requestId });
  })(request);
