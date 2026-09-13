import { subscribeSchema } from "@/api/calendar-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ calendarId: string }>;
};

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId }) => {
      const { calendarId } = await context.params;
      const body = subscribeSchema.parse(await readJson(request));
      const subscription = await getServices().follows.subscribeNewsletter({
        calendarId,
        email: body.email,
        userId: user?.id,
      });
      return jsonOk(subscription, { status: 201, requestId });
    },
    { auth: "optional", rateLimit: { limit: 10, windowMs: 60_000 } },
  )(request);
