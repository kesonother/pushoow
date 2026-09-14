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
      const services = getServices();
      const subscription = await services.follows.subscribeNewsletter({
        calendarId,
        email: body.email,
        userId: user?.id,
      });
      const calendar = await services.calendarRepo.findById(calendarId);
      await services.notifications.enqueue({
        userId: user?.id,
        channel: "email",
        to: body.email,
        templateKey: "subscriber_welcome",
        vars: { calendarName: calendar?.name ?? "Pushoow" },
        marketingConsent: true,
        idempotencyKey: `welcome:${calendarId}:${body.email.toLowerCase()}`,
      });
      return jsonOk(subscription, { status: 201, requestId });
    },
    { auth: "optional", rateLimit: { limit: 10, windowMs: 60_000 } },
  )(request);
