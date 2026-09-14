import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { presentCalendar, presentEvent } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ calendarId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(
    async ({ requestId }) => {
      const { calendarId } = await context.params;
      const services = getServices();
      const calendar = await services.calendarRepo.findById(calendarId);
      if (!calendar || calendar.deletedAt || calendar.visibility === "private") {
        return jsonOk({ calendar: null, events: [] }, { requestId });
      }
      const events = (await services.eventRepo.listByCalendar(calendar.id)).filter(
        (item) => !item.deletedAt && item.visibility === "public" && item.status !== "draft",
      );
      return jsonOk(
        { calendar: presentCalendar(calendar), events: events.slice(0, 20).map(presentEvent) },
        { requestId },
      );
    },
    { auth: "none" },
  )(request);

export const OPTIONS = publicOptions();
