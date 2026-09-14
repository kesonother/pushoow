import { resolveActor } from "@/api/authorize";
import { withApi } from "@/api/handler";
import { checkInRealtimeHub } from "@/domain/checkin/realtime";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, request }) => {
    const { eventId } = await context.params;
    const services = getServices();
    const event = await services.eventRepo.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    const actor = await resolveActor(services.access, user!.id, event.organizationId, user!.emailVerified);
    const initial = await services.checkin.counter(actor, eventId);
    const encoder = new TextEncoder();
    let unsubscribe: () => void = () => {};
    const stream = new ReadableStream({
      start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`event: counter\ndata: ${JSON.stringify(payload)}\n\n`));
        };
        send(initial);
        unsubscribe = checkInRealtimeHub.subscribe(eventId, (event) => send(event));
        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        }, 15_000);
        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          unsubscribe();
          controller.close();
        });
      },
      cancel() {
        unsubscribe();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  })(request);
