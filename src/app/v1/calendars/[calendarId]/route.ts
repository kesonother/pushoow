import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { presentCalendar } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ calendarId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { calendarId } = await context.params;
    const services = getServices();
    const calendar = await services.calendars.getCalendar(services.publicApi.actorFrom(principal!), calendarId);
    return jsonOk(presentCalendar(calendar), { requestId });
  }, { scope: "calendars:read" })(request);

export const OPTIONS = publicOptions();
