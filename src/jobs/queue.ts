import { ConflictError } from "@/domain/errors";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { backoffMs, type JobRecord, type JobRepository, type JobType } from "@/jobs/types";
import { increment, getQueueDepth, setQueueDepth } from "@/observability/metrics";

export type JobQueueDeps = {
  jobs: JobRepository;
  clock?: Clock;
  ids?: IdGenerator;
};

export function createJobQueue(deps: JobQueueDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function enqueue(input: {
    type: JobType;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    maxAttempts?: number;
    availableAt?: Date;
  }): Promise<JobRecord> {
    if (input.idempotencyKey) {
      const existing = await deps.jobs.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const now = clock.now();
    try {
      const created = await deps.jobs.create({
        id: ids.id(),
        type: input.type,
        payload: input.payload,
        status: "pending",
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 5,
        availableAt: input.availableAt ?? now,
        startedAt: null,
        finishedAt: null,
        lastError: null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdAt: now,
        updatedAt: now,
      });
      setQueueDepth(getQueueDepth() + 1);
      return created;
    } catch (error) {
      if (input.idempotencyKey) {
        const existing = await deps.jobs.findByIdempotencyKey(input.idempotencyKey);
        if (existing) return existing;
      }
      throw error instanceof Error
        ? error
        : new ConflictError("Unable to enqueue job");
    }
  }

  async function processNext(
    handlers: Partial<Record<JobType, (job: JobRecord) => Promise<void>>>,
  ): Promise<JobRecord | null> {
    const now = clock.now();
    const job = await deps.jobs.claimNext(now);
    if (!job) return null;
    setQueueDepth(getQueueDepth() - 1);

    const handler = handlers[job.type];
    if (!handler) {
      increment("queue.failed");
      await deps.jobs.save({
        ...job,
        status: "dead",
        lastError: `No handler registered for ${job.type}`,
        finishedAt: now,
        updatedAt: now,
      });
      return job;
    }

    try {
      await handler(job);
      increment("queue.processed");
      return deps.jobs.save({
        ...job,
        status: "completed",
        finishedAt: clock.now(),
        lastError: null,
        updatedAt: clock.now(),
      });
    } catch (error) {
      const attempts = job.attempts;
      const failed = attempts >= job.maxAttempts;
      const message = error instanceof Error ? error.message : "Unknown job error";
      increment("queue.failed");
      if (!failed) setQueueDepth(getQueueDepth() + 1);
      return deps.jobs.save({
        ...job,
        status: failed ? "dead" : "pending",
        lastError: message,
        availableAt: new Date(clock.now().getTime() + backoffMs(attempts)),
        finishedAt: failed ? clock.now() : null,
        updatedAt: clock.now(),
      });
    }
  }

  return { enqueue, processNext };
}
