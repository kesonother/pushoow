import { requireActorPermission, resolveCalendarActor } from "@/api/authorize";
import { newsletterWriteSchema } from "@/api/notification-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ newsletterId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { newsletterId } = await context.params;
    const services = getServices();
    const newsletter = await services.notifications.getNewsletter(newsletterId);
    if (!newsletter) throw new NotFoundError("Newsletter", newsletterId);
    await resolveCalendarActor(
      { memberships: services.access, calendars: services.calendarRepo },
      user!.id,
      newsletter.calendarId,
    );
    return jsonOk(newsletter, { requestId });
  })(request);

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { newsletterId } = await context.params;
    const services = getServices();
    const existing = await services.notifications.getNewsletter(newsletterId);
    if (!existing) throw new NotFoundError("Newsletter", newsletterId);
    const actor = await resolveCalendarActor(
      { memberships: services.access, calendars: services.calendarRepo },
      user!.id,
      existing.calendarId,
    );
    requireActorPermission(actor, "calendars:update");
    const body = newsletterWriteSchema.parse(await readJson(request));
    const newsletter = await services.notifications.saveNewsletter({
      id: newsletterId,
      organizationId: existing.organizationId,
      calendarId: existing.calendarId,
      subjectA: body.subjectA,
      subjectB: body.subjectB,
      blocks: body.blocks as never,
    });
    return jsonOk(newsletter, { requestId });
  })(request);
