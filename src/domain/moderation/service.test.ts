import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/domain/errors";
import { createModerationService } from "@/domain/moderation/service";
import type { ModerationAction, ModerationRepository } from "@/domain/moderation/types";

function memoryModeration(): ModerationRepository {
  const items = new Map<string, ModerationAction>();
  return {
    async create(action) {
      items.set(action.id, action);
      return action;
    },
    async listByUser(userId) {
      return [...items.values()].filter((item) => item.userId === userId);
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async save(action) {
      items.set(action.id, action);
      return action;
    },
  };
}

describe("account moderation", () => {
  it("gives a 7-day notice before a standard suspension", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const svc = createModerationService({
      moderation: memoryModeration(),
      clock: { now: () => now },
    });
    const action = await svc.record({
      userId: "user_1",
      type: "temporary_suspension",
      reason: "Repeated spam",
      reasonCategory: "policy",
    });
    expect(action.immediate).toBe(false);
    expect(action.startsAt.toISOString()).toBe("2026-01-08T00:00:00.000Z");
    await expect(svc.assertActive("user_1")).resolves.toBeUndefined();
  });

  it("applies immediate restriction for fraud or illegal activity", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const svc = createModerationService({
      moderation: memoryModeration(),
      clock: { now: () => now },
    });
    const action = await svc.record({
      userId: "user_1",
      type: "permanent_ban",
      reason: "Payment fraud",
      reasonCategory: "fraud",
    });
    expect(action.immediate).toBe(true);
    expect(action.startsAt).toEqual(now);
    await expect(svc.assertActive("user_1")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
