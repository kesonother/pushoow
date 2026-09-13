import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import {
  DEFAULT_NOTICE_DAYS,
  IMMEDIATE_CATEGORIES,
  type ModerationAction,
  type ModerationReasonCategory,
  type ModerationRepository,
  type ModerationType,
} from "@/domain/moderation/types";

export type ModerationServiceDeps = {
  moderation: ModerationRepository;
  clock?: Clock;
  ids?: IdGenerator;
  notify?: (action: ModerationAction) => Promise<void>;
};

export function createModerationService(deps: ModerationServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  function schedule(type: ModerationType, category: ModerationReasonCategory, now: Date) {
    const immediate =
      type === "warning" ? false : IMMEDIATE_CATEGORIES.includes(category);
    const noticeMs = immediate ? 0 : DEFAULT_NOTICE_DAYS * 24 * 60 * 60 * 1000;
    const startsAt = new Date(now.getTime() + noticeMs);
    return { immediate, noticeAt: now, startsAt };
  }

  async function record(input: {
    userId: string;
    type: ModerationType;
    reason: string;
    reasonCategory: ModerationReasonCategory;
    createdByUserId?: string | null;
    endsAt?: Date | null;
  }) {
    if (input.reason.trim().length < 3) {
      throw new ValidationError("A moderation reason is required");
    }
    const now = clock.now();
    const timing = schedule(input.type, input.reasonCategory, now);
    const action = await deps.moderation.create({
      id: ids.id(),
      userId: input.userId,
      type: input.type,
      reason: input.reason.trim(),
      reasonCategory: input.reasonCategory,
      immediate: timing.immediate,
      noticeAt: timing.noticeAt,
      startsAt: timing.startsAt,
      endsAt: input.endsAt ?? null,
      createdByUserId: input.createdByUserId ?? null,
      notifiedAt: null,
      appealStatus: "none",
      appealReason: null,
      appealedAt: null,
      appealResolvedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await deps.notify?.(action);
    return deps.moderation.save({ ...action, notifiedAt: clock.now(), updatedAt: clock.now() });
  }

  function isRestricting(action: ModerationAction, now: Date) {
    if (action.type === "warning") return false;
    if (now < action.startsAt) return false;
    if (action.type === "permanent_ban") return true;
    return !action.endsAt || now < action.endsAt;
  }

  async function assertActive(userId: string) {
    const history = await deps.moderation.listByUser(userId);
    const now = clock.now();
    const blocking = history.find((action) => isRestricting(action, now));
    if (blocking) {
      throw new ForbiddenError(
        blocking.type === "permanent_ban"
          ? "This account has been permanently banned"
          : "This account is temporarily suspended",
      );
    }
  }

  async function appeal(userId: string, actionId: string, reason: string) {
    const action = await deps.moderation.findById(actionId);
    if (!action || action.userId !== userId) {
      throw new NotFoundError("Moderation action", actionId);
    }
    if (action.appealStatus !== "none") {
      throw new ValidationError("An appeal has already been submitted");
    }
    const now = clock.now();
    return deps.moderation.save({
      ...action,
      appealStatus: "submitted",
      appealReason: reason.trim(),
      appealedAt: now,
      updatedAt: now,
    });
  }

  return {
    record,
    assertActive,
    appeal,
    listHistory: (userId: string) => deps.moderation.listByUser(userId),
    isRestricting,
  };
}
