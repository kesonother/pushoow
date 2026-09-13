import { ValidationError } from "@/domain/errors";

export function normalizeBannedWords(words: string[] | undefined): string[] {
  if (!words) return [];
  const normalized = [
    ...new Set(words.map((word) => word.trim().toLowerCase()).filter(Boolean)),
  ].slice(0, 200);
  if (normalized.some((word) => word.length > 40)) {
    throw new ValidationError("Banned words must be 40 characters or fewer");
  }
  return normalized;
}

export function assertAllowedBody(body: string, bannedWords: string[]): void {
  const haystack = body.toLowerCase();
  const hit = bannedWords.find((word) => word && haystack.includes(word));
  if (hit) {
    throw new ValidationError("This message contains a banned word");
  }
}
