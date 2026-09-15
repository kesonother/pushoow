import {
  AIProviderNotConfiguredError,
  type CoverPromptInput,
  type ImageAIProvider,
  type TextAIProvider,
  type TextCompletionInput,
} from "@/domain/ai/types";

type OpenAIOptions = {
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
};

function headers(apiKey: string) {
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
}

export function createOpenAITextProvider(options: OpenAIOptions = {}): TextAIProvider {
  const apiKey = options.apiKey ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    id: "openai",
    kind: "text",
    isConfigured: () => Boolean(apiKey),
    async complete(input: TextCompletionInput) {
      if (!apiKey) throw new AIProviderNotConfiguredError("openai");
      const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify({
          model: "gpt-4o-mini",
          store: input.privacy.retentionDays > 0 && input.privacy.trainingAllowed,
          max_tokens: input.maxTokens ?? 700,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.prompt },
          ],
        }),
      });
      if (!response.ok) throw new Error(`OpenAI text request failed (${response.status})`);
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return {
        providerId: "openai",
        model: "gpt-4o-mini",
        text: body.choices?.[0]?.message?.content ?? "",
      };
    },
  };
}

export function createOpenAIImageProvider(options: OpenAIOptions = {}): ImageAIProvider {
  const apiKey = options.apiKey ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    id: "openai",
    kind: "image",
    isConfigured: () => Boolean(apiKey),
    async generateCover(input: CoverPromptInput) {
      if (!apiKey) throw new AIProviderNotConfiguredError("openai");
      const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: input.prompt,
          size: "1024x1024",
        }),
      });
      if (!response.ok) throw new Error(`OpenAI image request failed (${response.status})`);
      const body = (await response.json()) as { data?: Array<{ url?: string }> };
      return {
        providerId: "openai",
        model: "gpt-image-1",
        imageUrl: body.data?.[0]?.url ?? null,
        prompt: input.prompt,
      };
    },
  };
}
