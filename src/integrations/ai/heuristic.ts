import { heuristicDescription } from "@/domain/ai/description";
import { interpretSearchIntent } from "@/domain/ai/intent";
import type { CoverPromptInput, ImageAIProvider, TextAIProvider, TextCompletionInput } from "@/domain/ai/types";
import { AI_PERSONAS, type AIPersona, type DescriptionInput } from "@/domain/ai/types";
import type { DiscoveryFormat } from "@/domain/discovery/types";

const FORMATS = new Set(["online", "in-person", "hybrid"]);

function parsePromptJson(prompt: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(prompt) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : { text: prompt };
  } catch {
    return { text: prompt };
  }
}

function asPersona(value: unknown): AIPersona {
  return typeof value === "string" && (AI_PERSONAS as readonly string[]).includes(value)
    ? (value as AIPersona)
    : "neutral";
}

function asFormat(value: unknown): DiscoveryFormat {
  return typeof value === "string" && FORMATS.has(value) ? (value as DiscoveryFormat) : "in-person";
}

export function createHeuristicTextProvider(): TextAIProvider {
  return {
    id: "heuristic",
    kind: "text",
    isConfigured: () => true,
    async complete(input: TextCompletionInput) {
      const payload = parsePromptJson(input.prompt);
      if (input.task === "description") {
        const descriptionInput: DescriptionInput = {
          title: String(payload.title ?? "Untitled event"),
          tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
          location: payload.location == null ? null : String(payload.location),
          format: asFormat(payload.format),
          persona: asPersona(payload.persona),
        };
        return {
          providerId: "heuristic",
          model: "heuristic-templates",
          text: heuristicDescription(descriptionInput),
        };
      }
      if (input.task === "search") {
        const query = String(payload.query ?? payload.text ?? "");
        const now = typeof payload.now === "string" ? new Date(payload.now) : new Date();
        const interpreted = interpretSearchIntent(query, now, "heuristic");
        return {
          providerId: "heuristic",
          model: "heuristic-intent",
          text: JSON.stringify({
            q: interpreted.filters.q,
            city: interpreted.filters.city,
            tag: interpreted.filters.tag,
            format: interpreted.filters.format,
            price: interpreted.filters.price,
            dateFrom: interpreted.filters.dateFrom?.toISOString(),
            dateTo: interpreted.filters.dateTo?.toISOString(),
            notes: interpreted.notes,
          }),
        };
      }
      return {
        providerId: "heuristic",
        model: "heuristic-passthrough",
        text: JSON.stringify({ suggestion: true, payload }),
      };
    },
  };
}

export function createHeuristicImageProvider(): ImageAIProvider {
  return {
    id: "heuristic",
    kind: "image",
    isConfigured: () => true,
    async generateCover(input: CoverPromptInput) {
      return {
        providerId: "heuristic",
        model: "heuristic-cover-brief",
        imageUrl: null,
        prompt: input.prompt,
      };
    },
  };
}
