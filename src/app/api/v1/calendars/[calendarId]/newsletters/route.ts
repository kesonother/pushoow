import { newsletterWriteSchema } from "@/api/notification-schemas";
import { requireActorPermission, resolveCalendarActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ calendarId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const services = getServices();
    await resolveCalendarActor(
      { memberships: services.access, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    return jsonOk(await services.notifications.listNewsletters(calendarId), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.access, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    requireActorPermission(actor, "calendars:update");
    const body = newsletterWriteSchema.parse(await readJson(request));
    const newsletter = await services.notifications.saveNewsletter({
      organizationId: actor.organizationId,
      calendarId,
      subjectA: body.subjectA,
      subjectB: body.subjectB,
      blocks: body.blocks as never,
    });
    return jsonOk(newsletter, { status: 201, requestId });
  })(request);
