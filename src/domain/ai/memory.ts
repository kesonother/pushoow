import type {
  AIConsentRepository,
  AIGenerationRecord,
  AIGenerationRepository,
  AIOrgPolicy,
  AIPolicyRepository,
  AIPrivacySettings,
} from "@/domain/ai/types";

export function createMemoryAIGenerations(): AIGenerationRepository {
  const items = new Map<string, AIGenerationRecord>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByOrganization(organizationId) {
      return [...items.values()]
        .filter((item) => item.organizationId === organizationId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    },
  };
}

export function createMemoryAIConsents(): AIConsentRepository {
  const items = new Map<string, AIPrivacySettings>();
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

export function createMemoryAIPolicies(): AIPolicyRepository {
  const items = new Map<string, AIOrgPolicy>();
  return {
    async findByOrganization(organizationId) {
      return items.get(organizationId) ?? null;
    },
    async upsert(item) {
      items.set(item.organizationId, item);
      return item;
    },
  };
}
