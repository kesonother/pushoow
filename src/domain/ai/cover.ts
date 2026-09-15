import type { CalendarPalette, CoverInput, CoverStyle, GeneratedCover } from "@/domain/ai/types";
import { AI_DISCLOSURE } from "@/domain/ai/types";

const STYLE_DIRECTION: Record<CoverStyle, string> = {
  modern_minimal: "modern minimal, ample negative space, geometric type, no clutter",
  retro: "retro print, halftone, warm paper grain, vintage poster",
  photographic: "photographic, natural light, shallow depth of field, no stock-photo clichés",
  illustrated: "illustrated, editorial drawing, limited palette, no photorealism",
};

export const FALLBACK_PALETTE: CalendarPalette = {
  primary: "#18181b",
  secondary: "#f4f4f5",
};

export function resolvePalette(input?: { primaryColor?: string | null; secondaryColor?: string | null }): CalendarPalette {
  return {
    primary: input?.primaryColor || FALLBACK_PALETTE.primary,
    secondary: input?.secondaryColor || FALLBACK_PALETTE.secondary,
  };
}

export function buildCoverPrompt(input: CoverInput): string {
  const tags = input.tags.length > 0 ? input.tags.join(", ") : "community event";
  return [
    `Event cover titled "${input.title}".`,
    `Style: ${STYLE_DIRECTION[input.style]}.`,
    `Calendar palette: primary ${input.palette.primary}, secondary ${input.palette.secondary}.`,
    `Motifs from tags: ${tags}.`,
    "No logos of unrelated brands, no readable personal data, no watermarks.",
  ].join(" ");
}

export function toGeneratedCover(input: {
  prompt: string;
  style: CoverStyle;
  palette: CalendarPalette;
  imageUrl: string | null;
  providerId: string;
  model: string;
  trainingAllowed: boolean;
}): GeneratedCover {
  return {
    prompt: input.prompt,
    style: input.style,
    palette: input.palette,
    imageUrl: input.imageUrl,
    status: input.imageUrl ? "generated" : "prepared",
    aiGenerated: true,
    disclosure: AI_DISCLOSURE,
    providerId: input.providerId,
    model: input.model,
    trainingAllowed: input.trainingAllowed,
  };
}
