import { resolveCalendarActor } from "@/api/authorize";
import { decideSchema } from "@/api/calendar-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ calendarId: string; membershipId: string }>;
};

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId, membershipId } = await context.params;
    const body = decideSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    const membership = await services.calendarMemberships.decide(actor, membershipId, body.decision);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: `calendar.membership.${body.decision}`,
      resourceType: "calendar_member",
      resourceId: membership.id,
      requestId,
    });
    return jsonOk(membership, { requestId });
  })(request);
