export const TEXT_OVERFLOW_CLASS = "min-w-0 max-w-full truncate";

export function graphemeLength(text: string): number {
  return [...text].length;
}

export function wouldOverflow(text: string, maxGraphemes: number): boolean {
  return graphemeLength(text) > maxGraphemes;
}
