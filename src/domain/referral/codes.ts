import { randomInt } from "node:crypto";
import { REFERRAL_CODE_PATTERN } from "./types";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  let value = "";
  for (let index = 0; index < 8; index += 1) {
    value += ALPHABET[randomInt(ALPHABET.length)];
  }
  return value;
}

export function normalizeReferralCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}
