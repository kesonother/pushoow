import { resolveCalendarActor } from "@/api/authorize";
import { wizardSchema } from "@/api/event-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ calendarId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { calendarId } = await context.params;
    const body = wizardSchema.parse(await readJson(request));
    const services = getServices();
    const actor = await resolveCalendarActor(
      { memberships: services.memberships, calendars: services.calendarRepo },
      user!.id,
      calendarId,
      user!.emailVerified,
    );
    const event = await services.events.saveWizardStep(
      actor,
      {
        ...body,
        calendarId,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      },
      body.step,
      body.eventId,
    );
    return jsonOk(event, { requestId });
  })(request);
