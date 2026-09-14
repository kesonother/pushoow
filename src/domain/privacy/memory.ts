import type {
  CcpaSettings,
  CcpaSettingsRepository,
  ConsentRecord,
  ConsentRepository,
  DataProcessingRecord,
  DeletionRequest,
  DeletionRequestRepository,
  PrivacyAuditEntry,
  PrivacyAuditRepository,
  ProcessingRecordRepository,
} from "@/domain/privacy/types";

export function memoryPrivacyAudit(): PrivacyAuditRepository {
  const items: PrivacyAuditEntry[] = [];
  return {
    async append(entry) {
      items.push(entry);
      return entry;
    },
    async listByActor(actorUserId) {
      return items.filter((item) => item.actorUserId === actorUserId);
    },
  };
}

export function memoryConsents(): ConsentRepository {
  const items: ConsentRecord[] = [];
  return {
    async create(item) {
      items.push(item);
      return item;
    },
    async listByUser(userId) {
      return items.filter((item) => item.userId === userId);
    },
  };
}

export function memoryDeletions(): DeletionRequestRepository {
  const items = new Map<string, DeletionRequest>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findOpenByUser(userId) {
      return (
        [...items.values()].find((item) => item.userId === userId && item.status === "pending") ?? null
      );
    },
    async listDue(now) {
      return [...items.values()].filter((item) => item.status === "pending" && item.dueAt <= now);
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
  };
}

export function memoryProcessing(): ProcessingRecordRepository {
  const items: DataProcessingRecord[] = [];
  return {
    async create(item) {
      items.push(item);
      return item;
    },
    async listByUser(userId) {
      return items.filter((item) => item.userId === userId);
    },
  };
}

export function memoryCcpa(): CcpaSettingsRepository {
  const items = new Map<string, CcpaSettings>();
  return {
    async findByUser(userId) {
      return items.get(userId) ?? null;
    },
    async upsert(item) {
      items.set(item.userId, item);
      return item;
    },
  };
}
