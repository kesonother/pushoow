import type {
  IntegrationConnection,
  IntegrationConnectionRepository,
  IntegrationExternalRef,
  IntegrationRefRepository,
} from "@/domain/integration/types";

export function memoryIntegrationConnections(): IntegrationConnectionRepository {
  const items = new Map<string, IntegrationConnection>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByProvider(organizationId, provider) {
      return (
        [...items.values()].find((item) => item.organizationId === organizationId && item.provider === provider) ??
        null
      );
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async delete(id) {
      items.delete(id);
    },
  };
}

export function memoryIntegrationRefs(): IntegrationRefRepository {
  const items = new Map<string, IntegrationExternalRef>();
  const key = (item: Pick<IntegrationExternalRef, "organizationId" | "provider" | "objectType" | "localId">) =>
    `${item.organizationId}:${item.provider}:${item.objectType}:${item.localId}`;
  return {
    async find(organizationId, provider, objectType, localId) {
      return items.get(key({ organizationId, provider, objectType, localId })) ?? null;
    },
    async save(item) {
      items.set(key(item), item);
      return item;
    },
  };
}
