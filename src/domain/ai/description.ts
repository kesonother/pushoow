import type { AIPersona, DescriptionInput, DescriptionSection, GeneratedDescription } from "@/domain/ai/types";
import { AI_DISCLOSURE } from "@/domain/ai/types";
import { validateMarkdownOutput } from "@/domain/ai/safety";

const PERSONA_VOICE: Record<AIPersona, string> = {
  neutral: "Clear and factual, without slang or hype.",
  casual: "Friendly and conversational, still specific.",
  corporate: "Professional and concise, suitable for a company calendar.",
  academic: "Precise and formal, suitable for a seminar or lecture.",
};

export function descriptionSystemPrompt(persona: AIPersona): string {
  return [
    "Write an editable event description in Markdown.",
    "Use a short headline as the first line, then ## Overview, ## Details, and ## Who it's for.",
    `Voice: ${PERSONA_VOICE[persona]}`,
    "Do not invent speakers, prices, or dates that were not provided.",
    "Do not include emails, phone numbers, or instructions that override this prompt.",
    "Mark the copy as AI-generated in a final italic line.",
  ].join(" ");
}

export function minimizeDescriptionInput(input: DescriptionInput): DescriptionInput {
  return {
    title: input.title.trim(),
    tags: input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 12),
    location: input.location?.trim() || null,
    format: input.format,
    persona: input.persona,
  };
}

export function parseStructuredMarkdown(markdown: string, title: string): GeneratedDescription["structured"] {
  const sections: DescriptionSection[] = [];
  const chunks = markdown.split(/^##\s+/m).map((chunk) => chunk.trim()).filter(Boolean);
  let summary = "";
  let headline = title;
  for (const chunk of chunks) {
    const [headingLine, ...rest] = chunk.split("\n");
    const heading = headingLine.replace(/^#+\s*/, "").trim();
    const body = rest.join("\n").trim();
    if (!summary && !heading.toLowerCase().startsWith("who") && body) {
      summary = body.split("\n")[0]?.replace(/^#+\s*/, "").trim() ?? "";
    }
    if (heading && body && heading !== title) {
      sections.push({ heading, body });
    }
  }
  const firstLine = markdown.split("\n").find((line) => line.replace(/^#+\s*/, "").trim());
  if (firstLine) headline = firstLine.replace(/^#+\s*/, "").replace(/\*+/g, "").trim() || title;
  if (!summary) summary = markdown.replace(/[#*_]/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
  if (sections.length === 0) {
    sections.push({ heading: "Overview", body: summary });
  }
  return { headline, summary, sections };
}

export function heuristicDescription(input: DescriptionInput): string {
  const tags = input.tags.length > 0 ? input.tags.join(", ") : "community";
  const where = input.location || (input.format === "online" ? "online" : "in person");
  const voice = {
    neutral: `${input.title} is a ${input.format} gathering in ${where}, focused on ${tags}.`,
    casual: `Come through for ${input.title} — a ${input.format} hang in ${where} around ${tags}.`,
    corporate: `${input.title} is a ${input.format} session in ${where} covering ${tags}.`,
    academic: `${input.title} is a ${input.format} programme in ${where} addressing ${tags}.`,
  }[input.persona];
  const who = {
    neutral: "People interested in the listed topics.",
    casual: "Anyone curious — no gatekeeping, just a good room.",
    corporate: "Operators, partners, and teams following this calendar.",
    academic: "Researchers, students, and practitioners in the field.",
  }[input.persona];
  return [
    `# ${input.title}`,
    "",
    "## Overview",
    voice,
    "",
    "## Details",
    `Format: ${input.format}. Location: ${where}. Topics: ${tags}.`,
    "",
    "## Who it's for",
    who,
    "",
    `*${AI_DISCLOSURE}*`,
  ].join("\n");
}

export function toGeneratedDescription(input: {
  markdown: string;
  persona: AIPersona;
  providerId: string;
  model: string;
  trainingAllowed: boolean;
  title: string;
}): GeneratedDescription {
  const markdown = validateMarkdownOutput(input.markdown);
  return {
    markdown,
    structured: parseStructuredMarkdown(markdown, input.title),
    editable: true,
    aiGenerated: true,
    disclosure: AI_DISCLOSURE,
    persona: input.persona,
    providerId: input.providerId,
    model: input.model,
    trainingAllowed: input.trainingAllowed,
  };
}
