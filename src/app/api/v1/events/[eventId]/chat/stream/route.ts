import { resolveChatActor } from "@/api/chat-actor";
import { withApi } from "@/api/handler";
import { chatRealtimeHub } from "@/domain/chat/realtime";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, url, request }) => {
    const { eventId } = await context.params;
    const actor = await resolveChatActor(user!, eventId);
    const services = getServices();
    await services.chat.getAccess(actor, eventId);
    const last = url.searchParams.get("afterSeq") ?? request.headers.get("last-event-id");
    const afterSeq = last ? Number(last) : 0;

    const encoder = new TextEncoder();
    let unsubscribe: () => void = () => {};
    const stream = new ReadableStream({
      start(controller) {
        const send = (event: { id: string; seq: number; type: string; payload: unknown }) => {
          controller.enqueue(
            encoder.encode(
              `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
            ),
          );
        };
        void services.chat
          .listMessages(actor, eventId, { afterSeq: Number.isFinite(afterSeq) ? afterSeq : 0, limit: 100 })
          .then((page) => {
            for (const item of [...page.items].sort((a, b) => a.seq - b.seq)) {
              send({ id: item.id, seq: item.seq, type: "message", payload: item });
            }
          });
        unsubscribe = chatRealtimeHub.subscribe(eventId, (event) => {
          send(event);
        });
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
