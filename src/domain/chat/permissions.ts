import { hasPermission } from "@/domain/rbac/permissions";
import { CHAT_ELIGIBLE_STATUSES, type ChatActor, type ChatRights } from "@/domain/chat/types";
import type { EventRegistration } from "@/domain/event/commerce-types";

export function isEligibleRegistrant(registration: EventRegistration | null): boolean {
  if (!registration) return false;
  return (CHAT_ELIGIBLE_STATUSES as readonly string[]).includes(registration.status);
}

export function resolveChatRights(input: {
  actor: ChatActor;
  registration: EventRegistration | null;
  banned: boolean;
  archived: boolean;
}): ChatRights {
  const staff = Boolean(
    input.actor.membership &&
      (hasPermission(input.actor.membership.role, "events:update") ||
        hasPermission(input.actor.membership.role, "registrants:manage")),
  );
  const organizer = Boolean(
    input.actor.membership && hasPermission(input.actor.membership.role, "events:update"),
  );
  const registrant = isEligibleRegistrant(input.registration);
  const read = staff || registrant;
  return {
    read,
    post: read && !input.banned && !input.archived,
    moderate: staff,
    organizer,
  };
}
