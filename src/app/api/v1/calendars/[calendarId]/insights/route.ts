import { requireActorPermission, resolveCalendarActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ calendarId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    requireActorPermission(actor, "organization:read");
    const insights = await services.discovery.insights(calendarId);
    if (!insights) throw new NotFoundError("Calendar", calendarId);
    return jsonOk(insights, { requestId });
  })(request);
