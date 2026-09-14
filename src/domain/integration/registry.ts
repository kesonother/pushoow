import { ValidationError } from "@/domain/errors";
import { INTEGRATION_SPECS } from "@/domain/integration/catalog";
import { createCatalogProvider } from "@/domain/integration/provider";
import type { IntegrationProvider, IntegrationProviderId } from "@/domain/integration/types";

export type IntegrationRegistry = {
  get: (id: IntegrationProviderId) => IntegrationProvider;
  list: () => IntegrationProvider[];
  register: (provider: IntegrationProvider) => void;
};

export function createIntegrationRegistry(seed?: IntegrationProvider[]): IntegrationRegistry {
  const providers = new Map<IntegrationProviderId, IntegrationProvider>();
  for (const spec of INTEGRATION_SPECS) {
    providers.set(spec.id, createCatalogProvider(spec));
  }
  for (const provider of seed ?? []) {
    providers.set(provider.id, provider);
  }

  return {
    get(id) {
      const provider = providers.get(id);
      if (!provider) throw new ValidationError("Unknown integration provider", { provider: id });
      return provider;
    },
    list() {
      return [...providers.values()];
    },
    register(provider) {
      providers.set(provider.id, provider);
    },
  };
}
