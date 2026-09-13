import { resolveCalendarActor } from "@/api/authorize";
import { joinSchema } from "@/api/calendar-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ calendarId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    const members = await services.calendarMemberships.listMembers(actor, calendarId);
    return jsonOk(members, { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId }) => {
      const { calendarId } = await context.params;
      const body = joinSchema.parse(await readJson(request));
      const membership = await getServices().calendarMemberships.requestJoin(
        user!.id,
        calendarId,
        body.tierId,
      );
      return jsonOk(membership, { status: 201, requestId });
    },
    { rateLimit: { limit: 20, windowMs: 60_000 } },
  )(request);
