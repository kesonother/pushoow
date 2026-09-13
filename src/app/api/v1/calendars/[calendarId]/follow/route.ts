import { followPreferencesSchema } from "@/api/calendar-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ calendarId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const follow = await getServices().follows.getFollow(user!.id, calendarId);
    return jsonOk({ following: Boolean(follow), follow }, { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId }) => {
      const { calendarId } = await context.params;
      const raw = await request.text();
      const body = followPreferencesSchema.parse(raw ? JSON.parse(raw) : {});
      const follow = await getServices().follows.follow(user!.id, calendarId, body);
      return jsonOk(follow, { status: 201, requestId });
    },
    { rateLimit: { limit: 30, windowMs: 60_000 } },
  )(request);

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const body = followPreferencesSchema.parse(await readJson(request));
    const follow = await getServices().follows.updatePreferences(user!.id, calendarId, body);
    return jsonOk(follow, { requestId });
  })(request);

export const DELETE = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    await getServices().follows.unfollow(user!.id, calendarId);
    return jsonOk({ following: false }, { requestId });
  })(request);
