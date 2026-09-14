import { and, eq, isNull, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { importBatch } from "@/db/schema/imports";
import type { ImportJob, ImportRepository } from "@/domain/import/types";

function toJob(row: typeof importBatch.$inferSelect): ImportJob {
  return {
    ...row,
    calendarId: row.calendarId ?? null,
    eventId: row.eventId ?? null,
    report: row.report ?? null,
    purgedAt: row.purgedAt ?? null,
  };
}

export function createDrizzleImportRepository(db: Database): ImportRepository {
  return {
    async create(job) {
      const [row] = await db.insert(importBatch).values(job).returning();
      return toJob(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(importBatch).where(eq(importBatch.id, id)).limit(1);
      return row ? toJob(row) : null;
    },
    async findByHash(input) {
      const [row] = await db
        .select()
        .from(importBatch)
        .where(
          and(
            eq(importBatch.organizationId, input.organizationId),
            eq(importBatch.kind, input.kind),
            eq(importBatch.targetKey, input.targetKey),
            eq(importBatch.contentHash, input.contentHash),
          ),
        )
        .limit(1);
      return row ? toJob(row) : null;
    },
    async save(job) {
      const [row] = await db.update(importBatch).set(job).where(eq(importBatch.id, job.id)).returning();
      return toJob(row!);
    },
    async listExpired(now) {
      const rows = await db
        .select()
        .from(importBatch)
        .where(and(isNull(importBatch.purgedAt), lte(importBatch.purgeAfter, now)));
      return rows.map(toJob);
    },
  };
}
