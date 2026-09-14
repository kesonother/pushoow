import { createHash } from "node:crypto";
import type { Newsletter, NewsletterBlock } from "@/domain/notification/types";

export const NEWSLETTER_BLOCK_TYPES = [
  "title",
  "paragraph",
  "event_embed",
  "image",
  "divider",
  "button",
] as const;

export function pickAbSubject(newsletter: Pick<Newsletter, "subjectA" | "subjectB">, recipientKey: string): {
  subject: string;
  variant: "a" | "b";
} {
  if (!newsletter.subjectB?.trim()) {
    return { subject: newsletter.subjectA, variant: "a" };
  }
  const digest = createHash("sha256").update(recipientKey).digest();
  const variant = digest[0]! % 2 === 0 ? "a" : "b";
  return {
    subject: variant === "a" ? newsletter.subjectA : newsletter.subjectB,
    variant,
  };
}

export function renderNewsletterHtml(blocks: NewsletterBlock[], events: Map<string, { title: string; href: string }>): string {
  const parts = blocks.map((block) => {
    if (block.type === "title") return `<h1>${escapeHtml(block.text)}</h1>`;
    if (block.type === "paragraph") return `<p>${escapeHtml(block.text)}</p>`;
    if (block.type === "divider") return "<hr />";
    if (block.type === "image") {
      return `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" />`;
    }
    if (block.type === "button") {
      return `<p><a href="${escapeHtml(block.href)}">${escapeHtml(block.label)}</a></p>`;
    }
    const event = events.get(block.eventId);
    const title = block.title ?? event?.title ?? "Event";
    const href = event?.href ?? "#";
    return `<p><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></p>`;
  });
  return `<article>${parts.join("")}</article>`;
}

export function previewWidths() {
  return { desktop: 640, mobile: 360 };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
