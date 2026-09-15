import { createHash } from "node:crypto";
import { ValidationError } from "@/domain/errors";

const MAX_USER_TEXT = 4_000;
const MAX_MARKDOWN = 20_000;

const INJECTION_PATTERNS = [
  /ignore (all |any )?previous instructions/i,
  /disregard (all |any )?(previous|above) (instructions|prompts)/i,
  /you are now/i,
  /system\s*:/i,
  /<\|im_start\|>/i,
  /\[INST\]/i,
  /<<\s*SYS\s*>>/i,
  /developer mode/i,
];

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g;
const SCRIPT_RE = /<\s*script/i;
const JS_URL_RE = /javascript\s*:/i;

export function assertSafeUserText(text: string, field = "input"): void {
  if (!text.trim()) {
    throw new ValidationError(`${field} is required`);
  }
  if (text.length > MAX_USER_TEXT) {
    throw new ValidationError(`${field} is too long`, { max: MAX_USER_TEXT });
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      throw new ValidationError("Prompt injection detected", { field });
    }
  }
}

export function redactPii(text: string): string {
  return text.replace(EMAIL_RE, "[redacted-email]").replace(PHONE_RE, "[redacted-phone]");
}

export function containsPii(text: string): boolean {
  return new RegExp(EMAIL_RE.source, "i").test(text) || new RegExp(PHONE_RE.source).test(text);
}

export function minimizeRecord<T extends Record<string, unknown>>(input: T, keys: (keyof T)[]): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of keys) {
    next[String(key)] = input[key];
  }
  return next;
}

export function validateMarkdownOutput(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) throw new ValidationError("AI output was empty");
  if (trimmed.length > MAX_MARKDOWN) throw new ValidationError("AI output is too long");
  if (SCRIPT_RE.test(trimmed) || JS_URL_RE.test(trimmed)) {
    throw new ValidationError("AI output failed safety validation");
  }
  if (/ignore previous instructions/i.test(trimmed) && /system prompt/i.test(trimmed)) {
    throw new ValidationError("AI output failed safety validation");
  }
  return redactPii(trimmed);
}

export function hashMinimizedInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function summarizeOutput(text: string, max = 80): string {
  const redacted = redactPii(text).replace(/\s+/g, " ").trim();
  return redacted.slice(0, max);
}

export function safeLogFields(input: {
  generationId?: string;
  providerId: string;
  task: string;
  ok: boolean;
}): Record<string, unknown> {
  return {
    generationId: input.generationId,
    providerId: input.providerId,
    task: input.task,
    ok: input.ok,
  };
}
