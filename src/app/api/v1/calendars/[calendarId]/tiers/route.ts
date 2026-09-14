import { resolveCalendarActor } from "@/api/authorize";
import { tierWriteSchema } from "@/api/calendar-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ calendarId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(
    async ({ requestId }) => {
      const { calendarId } = await context.params;
      const tiers = await getServices().calendarMemberships.listTiers(calendarId);
      return jsonOk(tiers, { requestId });
    },
    { auth: "optional" },
  )(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const body = tierWriteSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.access, calendars: services.calendarRepo },
      user!.id,
      calendarId,
    );
    const tier = await services.calendarMemberships.createTier(actor, calendarId, body);
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "calendar.tier.create",
      resourceType: "calendar_membership_tier",
      resourceId: tier.id,
      requestId,
    });
    return jsonOk(tier, { status: 201, requestId });
  })(request);
