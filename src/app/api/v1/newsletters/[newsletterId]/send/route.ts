import { requireActorPermission, resolveCalendarActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ newsletterId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { newsletterId } = await context.params;
    const services = getServices();
    const newsletter = await services.notifications.getNewsletter(newsletterId);
    if (!newsletter) throw new NotFoundError("Newsletter", newsletterId);
    const actor = await resolveCalendarActor(
      { memberships: services.access, calendars: services.calendarRepo },
      user!.id,
      newsletter.calendarId,
    );
    requireActorPermission(actor, "calendars:update");
    const list = await services.calendarSubscriptions.listByCalendar(newsletter.calendarId);
    await services.notifications.sendNewsletter({
      newsletter,
      recipients: list
        .filter((item) => item.status === "active")
        .map((item) => ({ email: item.email, userId: item.userId })),
    });
    return jsonOk({ sent: true }, { requestId });
  })(request);
