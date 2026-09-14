import type {
  PublicApiKey,
  PublicApiKeyRepository,
  PublicOAuthClient,
  PublicOAuthClientRepository,
  PublicOAuthCode,
  PublicOAuthCodeRepository,
  PublicWebhookDelivery,
  PublicWebhookDeliveryRepository,
  PublicWebhookEndpoint,
  PublicWebhookEndpointRepository,
} from "@/domain/public-api/types";

export function memoryPublicApiKeys(): PublicApiKeyRepository {
  const items = new Map<string, PublicApiKey>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findByHash(keyHash) {
      return [...items.values()].find((item) => item.keyHash === keyHash && !item.revokedAt) ?? null;
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
  };
}

export function memoryPublicOAuthClients(): PublicOAuthClientRepository {
  const items = new Map<string, PublicOAuthClient>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
  };
}

export function memoryPublicOAuthCodes(): PublicOAuthCodeRepository {
  const items = new Map<string, PublicOAuthCode>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findByHash(codeHash) {
      return [...items.values()].find((item) => item.codeHash === codeHash) ?? null;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
  };
}

export function memoryPublicWebhookEndpoints(): PublicWebhookEndpointRepository {
  const items = new Map<string, PublicWebhookEndpoint>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
  };
}

export function memoryPublicWebhookDeliveries(): PublicWebhookDeliveryRepository {
  const items = new Map<string, PublicWebhookDelivery>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByEndpoint(endpointId) {
      return [...items.values()].filter((item) => item.endpointId === endpointId);
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
  };
}
