import { jsonOk, readJson } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { publicRegistrationSchema } from "@/api/public-schemas";
import { presentRegistration } from "@/domain/public-api/present";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { eventId } = await context.params;
    const services = getServices();
    await services.events.getEvent(services.publicApi.actorFrom(principal!), eventId);
    const list = await services.eventRegistrations.listByEvent(eventId);
    return jsonOk(list.map(presentRegistration), { requestId });
  }, { scope: "registrations:read" })(request);

export const POST = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { eventId } = await context.params;
    const body = publicRegistrationSchema.parse(await readJson(request));
    const services = getServices();
    await services.events.getEvent(services.publicApi.actorFrom(principal!), eventId);
    const registration = await services.registrations.register({ ...body, eventId });
    return jsonOk(presentRegistration(registration), { status: 201, requestId });
  }, { scope: "registrations:write" })(request);

export const OPTIONS = publicOptions();
