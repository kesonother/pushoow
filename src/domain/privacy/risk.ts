import type { PaymentRiskInput, PaymentRiskResult } from "@/domain/privacy/types";

export const THREE_DS_AMOUNT_CENTS = 10_000;
export const THREE_DS_SCORE_THRESHOLD = 50;

export function assessPaymentRisk(input: PaymentRiskInput): PaymentRiskResult {
  const signals: string[] = [];
  let score = 0;

  if (input.amountCents >= THREE_DS_AMOUNT_CENTS) {
    signals.push("high_amount");
    score += 40;
  }
  if (input.billingCountry && input.ipCountry && input.billingCountry !== input.ipCountry) {
    signals.push("country_mismatch");
    score += 30;
  }
  if (input.velocityHits >= 3) {
    signals.push("velocity");
    score += 25;
  }
  if (input.accountAgeMs != null && input.accountAgeMs < 24 * 60 * 60 * 1000 && input.amountCents > 0) {
    signals.push("new_account");
    score += 20;
  }

  return {
    score: Math.min(100, score),
    signals,
    require3ds: score >= THREE_DS_SCORE_THRESHOLD || signals.includes("high_amount"),
  };
}
