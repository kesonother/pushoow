import { jsonOk, readJson } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { publicCheckInSchema } from "@/api/public-schemas";
import { presentCheckIn } from "@/domain/public-api/present";
import { cuidGenerator } from "@/lib/ids";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { eventId } = await context.params;
    const services = getServices();
    const records = await services.checkin.listRecords(services.publicApi.actorFrom(principal!), eventId);
    return jsonOk(records.map(presentCheckIn), { requestId });
  }, { scope: "checkins:read" })(request);

export const POST = (request: Request, context: RouteContext) =>
  withPublicApi(async ({ principal, requestId }) => {
    const { eventId } = await context.params;
    const body = publicCheckInSchema.parse(await readJson(request));
    const services = getServices();
    const result = await services.checkin.checkIn(services.publicApi.actorFrom(principal!), {
      ...body,
      eventId,
      clientOpId: body.clientOpId ?? cuidGenerator.id(),
    });
    return jsonOk(result, { requestId });
  }, { scope: "checkins:write" })(request);

export const OPTIONS = publicOptions();
