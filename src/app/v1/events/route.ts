import { jsonOk, readJson } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { publicEventCreateSchema } from "@/api/public-schemas";
import { presentEvent } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

export const GET = withPublicApi(async ({ principal, requestId, url }) => {
  const services = getServices();
  const actor = services.publicApi.actorFrom(principal!);
  const calendarId = url.searchParams.get("calendarId");
  const events = calendarId
    ? await services.events.listEvents(actor, calendarId)
    : await services.events.listEventsForOrganization(actor);
  return jsonOk(events.map(presentEvent), { requestId });
}, { scope: "events:read" });

export const POST = withPublicApi(async ({ principal, request, requestId }) => {
  const body = publicEventCreateSchema.parse(await readJson(request));
  const services = getServices();
  const event = await services.events.createEvent(services.publicApi.actorFrom(principal!), {
    ...body,
    startsAt: new Date(body.startsAt),
    endsAt: new Date(body.endsAt),
  });
  return jsonOk(presentEvent(event), { status: 201, requestId });
}, { scope: "events:write" });

export const OPTIONS = publicOptions();
