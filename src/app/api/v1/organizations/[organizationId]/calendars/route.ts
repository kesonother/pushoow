import { resolveActor } from "@/api/authorize";
import { createCalendarSchema } from "@/api/calendar-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { paginateById, parsePageQuery } from "@/api/pagination";
import { writeAuditLog } from "@/db/audit";
import { applyCalendarTemplate } from "@/domain/onboarding/templates";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, url, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId);
    const calendars = await services.calendars.listCalendars(actor);
    return jsonOk(paginateById(calendars, parsePageQuery(url.searchParams)), {
      requestId,
    });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId }) => {
      const { organizationId } = await context.params;
      const body = createCalendarSchema.parse(await readJson(request));
      const services = getServices();
      const actor = await resolveActor(services.access, user!.id, organizationId);
      const calendar = await services.calendars.createCalendar(actor, applyCalendarTemplate(body));

      await writeAuditLog(services.db, {
        organizationId: actor.organizationId,
        actorUserId: user!.id,
        action: "calendar.create",
        resourceType: "calendar",
        resourceId: calendar.id,
        requestId,
      });

      return jsonOk(calendar, { status: 201, requestId });
    },
    { rateLimit: { limit: 20, windowMs: 60_000 } },
  )(request);
