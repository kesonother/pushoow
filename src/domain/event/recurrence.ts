import { ValidationError } from "@/domain/errors";
import { addDaysZoned, addMonthsZoned, zonedParts } from "@/domain/event/timezone";

export const RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export type RecurrenceRule = {
  id: string;
  organizationId: string;
  eventId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  until: Date | null;
  count: number | null;
  exceptions: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type OccurrenceOverride = {
  id: string;
  organizationId: string;
  eventId: string;
  originalStartsAt: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  cancelled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type RecurrenceRuleRepository = {
  save: (rule: RecurrenceRule) => Promise<RecurrenceRule>;
  findByEvent: (eventId: string) => Promise<RecurrenceRule | null>;
};

export type OccurrenceOverrideRepository = {
  save: (override: OccurrenceOverride) => Promise<OccurrenceOverride>;
  findByEventAndOriginal: (
    eventId: string,
    originalStartsAt: Date,
  ) => Promise<OccurrenceOverride | null>;
  listByEvent: (eventId: string) => Promise<OccurrenceOverride[]>;
};

export type ExpandedOccurrence = {
  originalStartsAt: Date;
  startsAt: Date;
  endsAt: Date;
  cancelled: boolean;
  overridden: boolean;
};

function assertRule(rule: Pick<RecurrenceRule, "interval" | "count" | "until" | "weekdays">) {
  if (rule.interval < 1) throw new ValidationError("Recurrence interval must be at least 1");
  if (rule.count != null && rule.count < 1) {
    throw new ValidationError("Recurrence count must be at least 1");
  }
  if (rule.weekdays.some((day) => day < 0 || day > 6)) {
    throw new ValidationError("Weekdays must be between 0 (Sunday) and 6");
  }
}

export function expandRecurrence(input: {
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  rule: Pick<RecurrenceRule, "frequency" | "interval" | "weekdays" | "until" | "count" | "exceptions">;
  overrides?: OccurrenceOverride[];
  limit?: number;
}): ExpandedOccurrence[] {
  assertRule(input.rule);
  const duration = input.endsAt.getTime() - input.startsAt.getTime();
  const max = input.limit ?? 120;
  const exceptions = new Set(input.rule.exceptions);
  const overrideMap = new Map(
    (input.overrides ?? []).map((item) => [item.originalStartsAt.toISOString(), item]),
  );
  const occurrences: ExpandedOccurrence[] = [];
  let cursor = input.startsAt;
  let produced = 0;
  let safety = 0;

  while (occurrences.length < max && safety < 800) {
    safety += 1;
    if (input.rule.count != null && produced >= input.rule.count) break;
    if (input.rule.until && cursor > input.rule.until) break;

    const weekday = zonedParts(cursor, input.timezone).weekday;
    const matchesWeekday =
      input.rule.frequency !== "weekly" ||
      input.rule.weekdays.length === 0 ||
      input.rule.weekdays.includes(weekday);

    if (matchesWeekday) {
      produced += 1;
      const key = cursor.toISOString();
      if (!exceptions.has(key)) {
        const override = overrideMap.get(key);
        occurrences.push({
          originalStartsAt: cursor,
          startsAt: override?.startsAt ?? cursor,
          endsAt: override?.endsAt ?? new Date(cursor.getTime() + duration),
          cancelled: override?.cancelled ?? false,
          overridden: Boolean(override),
        });
      }
    }

    if (input.rule.frequency === "daily") {
      cursor = addDaysZoned(cursor, input.rule.interval, input.timezone);
    } else if (input.rule.frequency === "weekly") {
      cursor = addDaysZoned(cursor, input.rule.weekdays.length ? 1 : 7 * input.rule.interval, input.timezone);
    } else {
      cursor = addMonthsZoned(cursor, input.rule.interval, input.timezone);
    }
  }

  return occurrences;
}
