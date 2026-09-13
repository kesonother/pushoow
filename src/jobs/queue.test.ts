import { describe, expect, it } from "vitest";
import { createJobQueue } from "@/jobs/queue";
import { backoffMs, type JobRecord, type JobRepository } from "@/jobs/types";

function memoryJobs(): JobRepository {
  const items = new Map<string, JobRecord>();

  return {
    async create(job) {
      items.set(job.id, job);
      return job;
    },
    async findByIdempotencyKey(key) {
      return [...items.values()].find((job) => job.idempotencyKey === key) ?? null;
    },
    async claimNext(now) {
      const next = [...items.values()].find(
        (job) => job.status === "pending" && job.availableAt <= now,
      );
      if (!next) return null;
      const claimed = {
        ...next,
        status: "processing" as const,
        attempts: next.attempts + 1,
        startedAt: now,
        updatedAt: now,
      };
      items.set(claimed.id, claimed);
      return claimed;
    },
    async save(job) {
      items.set(job.id, job);
      return job;
    },
  };
}

describe("job queue", () => {
  it("is idempotent when the same key is reused", async () => {
    const queue = createJobQueue({ jobs: memoryJobs() });
    const first = await queue.enqueue({
      type: "email.send",
      payload: { to: "a@example.com" },
      idempotencyKey: "welcome-1",
    });
    const second = await queue.enqueue({
      type: "email.send",
      payload: { to: "b@example.com" },
      idempotencyKey: "welcome-1",
    });
    expect(second.id).toBe(first.id);
    expect(second.payload).toEqual(first.payload);
  });

  it("retries with backoff then moves the job to the dead letter", async () => {
    const jobs = memoryJobs();
    let now = new Date("2026-01-01T00:00:00.000Z");
    const queue = createJobQueue({
      jobs,
      clock: { now: () => now },
    });

    await queue.enqueue({
      type: "webhook.deliver",
      payload: { url: "https://example.test" },
      maxAttempts: 2,
    });

    const first = await queue.processNext({
      "webhook.deliver": async () => {
        throw new Error("timeout");
      },
    });
    expect(first?.status).toBe("pending");
    expect(first?.lastError).toBe("timeout");

    now = first!.availableAt;
    const dead = await queue.processNext({
      "webhook.deliver": async () => {
        throw new Error("timeout");
      },
    });
    expect(dead?.status).toBe("dead");
  });

  it("computes exponential backoff", () => {
    expect(backoffMs(1)).toBe(500);
    expect(backoffMs(2)).toBe(1000);
    expect(backoffMs(10)).toBe(60_000);
  });
});
