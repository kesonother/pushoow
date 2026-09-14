import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { presentCalendar } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

export const GET = withPublicApi(async ({ principal, requestId }) => {
  const services = getServices();
  const calendars = await services.calendars.listCalendars(services.publicApi.actorFrom(principal!));
  return jsonOk(calendars.map(presentCalendar), { requestId });
}, { scope: "calendars:read" });

export const OPTIONS = publicOptions();
