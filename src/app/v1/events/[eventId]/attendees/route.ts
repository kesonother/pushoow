import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { presentAttendee } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { eventId } = await context.params;
    const services = getServices();
    await services.events.getEvent(services.publicApi.actorFrom(principal!), eventId);
    const attendees = (await services.eventRegistrations.listByEvent(eventId)).filter((item) =>
      ["confirmed", "checked_in", "pending", "offered"].includes(item.status),
    );
    return jsonOk(attendees.map(presentAttendee), { requestId });
  }, { scope: "attendees:read" })(request);

export const OPTIONS = publicOptions();
