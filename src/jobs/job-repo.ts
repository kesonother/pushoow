import { and, eq, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { job } from "@/db/schema";
import type { JobRecord, JobRepository, JobStatus, JobType } from "@/jobs/types";

function mapJob(row: typeof job.$inferSelect): JobRecord {
  return {
    id: row.id,
    type: row.type as JobType,
    payload: row.payload,
    status: row.status as JobStatus,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    availableAt: row.availableAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    lastError: row.lastError,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleJobRepository(db: Database): JobRepository {
  return {
    async create(item) {
      const [row] = await db.insert(job).values(item).returning();
      return mapJob(row);
    },
    async findByIdempotencyKey(key) {
      const [row] = await db.select().from(job).where(eq(job.idempotencyKey, key)).limit(1);
      return row ? mapJob(row) : null;
    },
    async claimNext(now) {
      const [row] = await db
        .select()
        .from(job)
        .where(and(eq(job.status, "pending"), lte(job.availableAt, now)))
        .limit(1);

      if (!row) return null;

      const [claimed] = await db
        .update(job)
        .set({
          status: "processing",
          attempts: row.attempts + 1,
          startedAt: now,
          updatedAt: now,
        })
        .where(and(eq(job.id, row.id), eq(job.status, "pending")))
        .returning();

      return claimed ? mapJob(claimed) : null;
    },
    async save(item) {
      const [row] = await db
        .update(job)
        .set({
          status: item.status,
          attempts: item.attempts,
          availableAt: item.availableAt,
          startedAt: item.startedAt,
          finishedAt: item.finishedAt,
          lastError: item.lastError,
          updatedAt: item.updatedAt,
        })
        .where(eq(job.id, item.id))
        .returning();
      return mapJob(row);
    },
  };
}
