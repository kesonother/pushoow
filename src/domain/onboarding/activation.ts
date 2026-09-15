import { increment } from "@/observability/metrics";
import {
  ACTIVATION_EVENTS,
  type ActivationEventName,
  type ActivationRecord,
  type ActivationSnapshot,
  type AttendeeStep,
} from "./types";

type Trackable = ActivationEventName | AttendeeStep | "share";

const FIRST_ONLY = new Set<Trackable>(["signup", "first_rsvp", "first_follow", "first_checkin", "first_event", "share"]);

const records: ActivationRecord[] = [];

export function resetActivation() {
  records.length = 0;
}

export function recordedActivation(userId: string, name: Trackable): ActivationRecord | undefined {
  return records.find((item) => item.userId === userId && item.name === name);
}

export function listActivation(userId?: string): ActivationRecord[] {
  return userId ? records.filter((item) => item.userId === userId) : [...records];
}

export function trackActivation(input: {
  userId: string;
  name: Trackable;
  organizationId?: string;
  now?: Date;
}): boolean {
  if (FIRST_ONLY.has(input.name) && recordedActivation(input.userId, input.name)) {
    return false;
  }
  records.push({
    userId: input.userId,
    name: input.name,
    organizationId: input.organizationId,
    occurredAt: input.now ?? new Date(),
  });
  if ((ACTIVATION_EVENTS as readonly string[]).includes(input.name)) {
    increment("activation.events", { name: input.name });
  }
  return true;
}

export function activationSnapshot(): ActivationSnapshot {
  const counts = Object.fromEntries(ACTIVATION_EVENTS.map((name) => [name, 0])) as Record<ActivationEventName, number>;
  for (const record of records) {
    if ((ACTIVATION_EVENTS as readonly string[]).includes(record.name)) {
      counts[record.name as ActivationEventName] += 1;
    }
  }
  return { counts };
}
