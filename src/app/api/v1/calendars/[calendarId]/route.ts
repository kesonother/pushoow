import { resolveCalendarActor } from "@/api/authorize";
import { calendarWriteSchema } from "@/api/calendar-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
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
    const calendar = await services.calendars.getCalendar(actor, calendarId);
    return jsonOk(calendar, { requestId });
  })(request);

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const body = calendarWriteSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    const calendar = await services.calendars.updateCalendar(actor, calendarId, body);

    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "calendar.update",
      resourceType: "calendar",
      resourceId: calendar.id,
      metadata: body,
      requestId,
    });

    return jsonOk(calendar, { requestId });
  })(request);

export const DELETE = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    const calendar = await services.calendars.deleteCalendar(actor, calendarId);

    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "calendar.delete",
      resourceType: "calendar",
      resourceId: calendar.id,
      requestId,
    });

    return jsonOk({ id: calendar.id, deleted: true }, { requestId });
  })(request);
