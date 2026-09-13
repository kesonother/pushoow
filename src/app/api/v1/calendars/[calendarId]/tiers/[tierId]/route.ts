import { resolveCalendarActor } from "@/api/authorize";
import { tierWriteSchema } from "@/api/calendar-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ calendarId: string; tierId: string }>;
};

export const PATCH = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId, tierId } = await context.params;
    const body = tierWriteSchema.partial().parse(await readJson(request));
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    const tier = await services.calendarMemberships.updateTier(actor, tierId, body);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "calendar.tier.update",
      resourceType: "calendar_membership_tier",
      resourceId: tier.id,
      requestId,
    });
    return jsonOk(tier, { requestId });
  })(request);

export const DELETE = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId, tierId } = await context.params;
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    await services.calendarMemberships.deleteTier(actor, tierId);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "calendar.tier.delete",
      resourceType: "calendar_membership_tier",
      resourceId: tierId,
      requestId,
    });
    return jsonOk({ id: tierId, deleted: true }, { requestId });
  })(request);
