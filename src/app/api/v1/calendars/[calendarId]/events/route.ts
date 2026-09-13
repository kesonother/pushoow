import { resolveCalendarActor } from "@/api/authorize";
import { createEventSchema } from "@/api/event-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { paginateById, parsePageQuery } from "@/api/pagination";
import { EVENT_STATUSES } from "@/domain/event/types";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ calendarId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, url, requestId }) => {
    const { calendarId } = await context.params;
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    const status = url.searchParams.get("status");
    const events = await services.events.listEvents(actor, calendarId, {
      status: status && EVENT_STATUSES.includes(status as (typeof EVENT_STATUSES)[number])
        ? (status as (typeof EVENT_STATUSES)[number])
        : undefined,
      from: url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined,
      to: url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined,
    });
    return jsonOk(paginateById(events, parsePageQuery(url.searchParams)), { requestId });
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId }) => {
      const { calendarId } = await context.params;
      const body = createEventSchema.parse(await readJson(request));
      const services = getServices();
      const actor = await resolveCalendarActor(
        { memberships: services.memberships, calendars: services.calendarRepo },
        user!.id,
        calendarId,
        user!.emailVerified,
      );
      const event = await services.events.createEvent(actor, {
        ...body,
        calendarId,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      });
      await writeAuditLog(services.db, {
        organizationId: actor.organizationId,
        actorUserId: user!.id,
        action: "event.create",
        resourceType: "event",
        resourceId: event.id,
        requestId,
      });
      return jsonOk(event, { status: 201, requestId });
    },
    { rateLimit: { limit: 30, windowMs: 60_000 } },
  )(request);
