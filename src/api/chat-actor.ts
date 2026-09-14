import { resolveActor } from "@/api/authorize";
import { ForbiddenError, NotFoundError } from "@/domain/errors";
import type { ChatActor } from "@/domain/chat/types";
import { getServices } from "@/server/container";

export async function resolveChatActor(
  user: { id: string; email?: string | null },
  eventId: string,
): Promise<ChatActor> {
  const services = getServices();
  const event = await services.eventRepo.findById(eventId);
  if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
  let membership = null;
  try {
    membership = await resolveActor(services.access, user.id, event.organizationId);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
  }
  return {
    userId: user.id,
    email: user.email ?? null,
    membership,
  };
}
