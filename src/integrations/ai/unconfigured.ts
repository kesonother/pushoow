import {
  AIProviderNotConfiguredError,
  type ImageAIProvider,
  type TextAIProvider,
} from "@/domain/ai/types";

export const unconfiguredTextProvider: TextAIProvider = {
  id: "unconfigured",
  kind: "text",
  isConfigured: () => false,
  async complete() {
    throw new AIProviderNotConfiguredError("unconfigured");
  },
};

export const unconfiguredImageProvider: ImageAIProvider = {
  id: "unconfigured",
  kind: "image",
  isConfigured: () => false,
  async generateCover() {
    throw new AIProviderNotConfiguredError("unconfigured");
  },
};
