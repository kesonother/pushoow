import { resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const events = await services.events.listEventsForOrganization(actor);
    return jsonOk(
      events.map((event) => ({
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        status: event.status,
        capacity: event.capacity,
        isPaid: event.isPaid,
      })),
      { requestId },
    );
  })(request);
