import type { PlanId } from "@/domain/billing/types";
import {
  TICKET_PRIORITIES,
  type BusinessHours,
  type SlaPolicy,
  type SupportSlaView,
  type SupportTicket,
  type TicketPriority,
} from "@/domain/support/types";

const HOUR_MS = 3_600_000;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: "UTC",
  weekdays: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 18,
};

export function firstResponseHours(baseHours: number, priority: TicketPriority): number {
  if (priority === "low") return baseHours * 1.5;
  if (priority === "high") return baseHours * 0.5;
  if (priority === "urgent") return Math.max(1, baseHours / 4);
  return baseHours;
}

export function resolutionHours(baseHours: number, priority: TicketPriority): number {
  return firstResponseHours(baseHours, priority) * 2;
}

export function aroundTheClockFromSlaHours(supportSlaHours: number): boolean {
  return supportSlaHours <= 4;
}

export function slaPolicyFromEntitlements(planId: PlanId, supportSlaHours: number): SlaPolicy {
  const aroundTheClock = aroundTheClockFromSlaHours(supportSlaHours);
  const first: Record<TicketPriority, number> = {
    low: firstResponseHours(supportSlaHours, "low"),
    normal: firstResponseHours(supportSlaHours, "normal"),
    high: firstResponseHours(supportSlaHours, "high"),
    urgent: firstResponseHours(supportSlaHours, "urgent"),
  };
  return {
    id: `sla:${planId}:${supportSlaHours}`,
    planId,
    aroundTheClock,
    businessHours: aroundTheClock ? null : DEFAULT_BUSINESS_HOURS,
    escalateOnFirstResponseBreach: true,
    firstResponseHours: first,
    resolutionHours: {
      low: first.low * 2,
      normal: first.normal * 2,
      high: first.high * 2,
      urgent: first.urgent * 2,
    },
  };
}

export function nextPriority(priority: TicketPriority): TicketPriority {
  const index = TICKET_PRIORITIES.indexOf(priority);
  return TICKET_PRIORITIES[Math.min(index + 1, TICKET_PRIORITIES.length - 1)]!;
}

function atUtcHour(date: Date, hour: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, 0, 0, 0));
}

function nextUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
}

function isBusinessDay(date: Date, hours: BusinessHours): boolean {
  return hours.weekdays.includes(date.getUTCDay());
}

export function snapToBusinessWindow(date: Date, hours: BusinessHours): Date {
  let cursor = new Date(date.getTime());
  for (let i = 0; i < 21; i += 1) {
    if (!isBusinessDay(cursor, hours)) {
      cursor = atUtcHour(nextUtcDay(cursor), hours.startHour);
      continue;
    }
    const start = atUtcHour(cursor, hours.startHour);
    const end = atUtcHour(cursor, hours.endHour);
    if (cursor.getTime() < start.getTime()) return start;
    if (cursor.getTime() >= end.getTime()) {
      cursor = atUtcHour(nextUtcDay(cursor), hours.startHour);
      continue;
    }
    return cursor;
  }
  return cursor;
}

export function addBusinessHours(from: Date, hours: number, businessHours: BusinessHours): Date {
  if (hours <= 0) return new Date(from.getTime());
  let remaining = hours * HOUR_MS;
  let cursor = snapToBusinessWindow(from, businessHours);
  for (let i = 0; i < 400 && remaining > 0; i += 1) {
    const end = atUtcHour(cursor, businessHours.endHour);
    const available = end.getTime() - cursor.getTime();
    if (available <= 0) {
      cursor = snapToBusinessWindow(atUtcHour(nextUtcDay(cursor), businessHours.startHour), businessHours);
      continue;
    }
    if (available >= remaining) return new Date(cursor.getTime() + remaining);
    remaining -= available;
    cursor = snapToBusinessWindow(atUtcHour(nextUtcDay(cursor), businessHours.startHour), businessHours);
  }
  return cursor;
}

export function addWorkingDuration(from: Date, hours: number, policy: SlaPolicy): Date {
  if (policy.aroundTheClock || !policy.businessHours) {
    return new Date(from.getTime() + hours * HOUR_MS);
  }
  return addBusinessHours(from, hours, policy.businessHours);
}

export function computeDeadlines(input: {
  from: Date;
  priority: TicketPriority;
  policy: SlaPolicy;
}): { firstResponseDueAt: Date; resolutionDueAt: Date } {
  return {
    firstResponseDueAt: addWorkingDuration(input.from, input.policy.firstResponseHours[input.priority], input.policy),
    resolutionDueAt: addWorkingDuration(input.from, input.policy.resolutionHours[input.priority], input.policy),
  };
}

export function slaViewFor(ticket: SupportTicket, now: Date, aroundTheClock: boolean): SupportSlaView {
  const applicable = ticket.status !== "resolved" && ticket.status !== "closed";
  return {
    applicable,
    firstResponseDueAt: ticket.firstResponseDueAt.toISOString(),
    resolutionDueAt: ticket.resolutionDueAt.toISOString(),
    firstResponseBreached:
      Boolean(ticket.firstResponseBreachedAt) ||
      (!ticket.firstRespondedAt && now.getTime() > ticket.firstResponseDueAt.getTime()),
    resolutionBreached:
      Boolean(ticket.resolutionBreachedAt) ||
      (!ticket.resolvedAt && now.getTime() > ticket.resolutionDueAt.getTime()),
    aroundTheClock,
  };
}

export type SlaTickResult = {
  changed: boolean;
  ticket: SupportTicket;
  events: Array<{ type: "sla_breached" | "sla_escalated"; metadata: Record<string, unknown> }>;
};

export function evaluateSlaTick(ticket: SupportTicket, now: Date, policy: SlaPolicy): SlaTickResult {
  const events: SlaTickResult["events"] = [];
  let next = { ...ticket };
  const open = ticket.status === "open" || ticket.status === "assigned" || ticket.status === "pending";
  if (!open) return { changed: false, ticket, events };

  if (!ticket.firstRespondedAt && !ticket.firstResponseBreachedAt && now.getTime() > ticket.firstResponseDueAt.getTime()) {
    next = { ...next, firstResponseBreachedAt: now, updatedAt: now };
    events.push({ type: "sla_breached", metadata: { kind: "first_response" } });
    if (policy.escalateOnFirstResponseBreach) {
      const escalated = nextPriority(next.priority);
      if (escalated !== next.priority) {
        const deadlines = computeDeadlines({ from: ticket.createdAt, priority: escalated, policy });
        next = {
          ...next,
          priority: escalated,
          resolutionDueAt: deadlines.resolutionDueAt,
        };
        events.push({
          type: "sla_escalated",
          metadata: { from: ticket.priority, to: escalated, reason: "first_response_breach" },
        });
      }
    }
  }

  if (!ticket.resolvedAt && !ticket.resolutionBreachedAt && now.getTime() > ticket.resolutionDueAt.getTime()) {
    next = { ...next, resolutionBreachedAt: now, updatedAt: now };
    events.push({ type: "sla_breached", metadata: { kind: "resolution" } });
  }

  return { changed: events.length > 0, ticket: next, events };
}

export function formatTicketNumber(year: number, sequence: number): string {
  return `SUP-${year}-${String(sequence).padStart(4, "0")}`;
}
