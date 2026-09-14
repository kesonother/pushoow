import { childLogger } from "@/lib/logger";
import type { IntegrationDomainEvent, IntegrationEmitter } from "@/domain/integration/types";

const log = childLogger({ module: "integration" });

/** Integration failures must never fail Event / registration / check-in writes. */
export async function emitIntegrationEvent(
  emitter: IntegrationEmitter | undefined,
  event: IntegrationDomainEvent,
): Promise<void> {
  if (!emitter) return;
  try {
    await emitter.emit(event);
  } catch (error) {
    log.warn({ err: error, type: event.type, organizationId: event.organizationId }, "Integration emit ignored");
  }
}
