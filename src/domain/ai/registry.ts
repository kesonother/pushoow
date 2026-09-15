import { NotFoundError } from "@/domain/errors";
import type {
  AIProvider,
  AIProviderRegistry,
  ImageAIProvider,
  TextAIProvider,
} from "@/domain/ai/types";

export function isTextProvider(provider: AIProvider): provider is TextAIProvider {
  return provider.kind === "text";
}

export function isImageProvider(provider: AIProvider): provider is ImageAIProvider {
  return provider.kind === "image";
}

export function createAIProviderRegistry(input: {
  text: TextAIProvider[];
  image: ImageAIProvider[];
  defaultTextId: string;
  defaultImageId: string;
}): AIProviderRegistry {
  const textById = new Map(input.text.map((provider) => [provider.id, provider]));
  const imageById = new Map(input.image.map((provider) => [provider.id, provider]));

  return {
    text(id) {
      const provider = textById.get(id ?? input.defaultTextId) ?? textById.get(input.defaultTextId);
      if (!provider) throw new NotFoundError("AI text provider", id ?? input.defaultTextId);
      return provider;
    },
    image(id) {
      const provider = imageById.get(id ?? input.defaultImageId) ?? imageById.get(input.defaultImageId);
      if (!provider) throw new NotFoundError("AI image provider", id ?? input.defaultImageId);
      return provider;
    },
    list() {
      const seen = new Set<string>();
      const providers: AIProvider[] = [];
      for (const provider of [...input.text, ...input.image]) {
        const key = `${provider.kind}:${provider.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        providers.push(provider);
      }
      return providers;
    },
  };
}
