import type { ImportJob, ImportRepository } from "@/domain/import/types";

export function memoryImports(): ImportRepository {
  const items = new Map<string, ImportJob>();
  return {
    async create(job) {
      items.set(job.id, job);
      return job;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByHash(input) {
      return (
        [...items.values()].find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.kind === input.kind &&
            item.targetKey === input.targetKey &&
            item.contentHash === input.contentHash,
        ) ?? null
      );
    },
    async save(job) {
      items.set(job.id, job);
      return job;
    },
    async listExpired(now) {
      return [...items.values()].filter((item) => !item.purgedAt && item.purgeAfter.getTime() <= now.getTime());
    },
  };
}
