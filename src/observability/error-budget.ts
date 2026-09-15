import { SLO_TARGETS, type SloEvaluation } from "./slo";

export type ErrorBudget = {
  sloId: SloEvaluation["id"];
  target: number;
  allowedErrorRate: number;
  observedErrorRate: number | null;
  consumedFraction: number | null;
  remainingFraction: number | null;
  sampleSize: number;
};

export function errorBudgetFromAvailability(ok: number, total: number): ErrorBudget {
  const allowedErrorRate = 1 - SLO_TARGETS.availability;
  const observedErrorRate = total === 0 ? null : (total - ok) / total;
  const consumedFraction =
    observedErrorRate === null ? null : allowedErrorRate === 0 ? 1 : observedErrorRate / allowedErrorRate;
  return {
    sloId: "availability",
    target: SLO_TARGETS.availability,
    allowedErrorRate,
    observedErrorRate,
    consumedFraction,
    remainingFraction: consumedFraction === null ? null : Math.max(0, 1 - consumedFraction),
    sampleSize: total,
  };
}

export function errorBudgetFromCheckout(succeeded: number, failed: number): ErrorBudget {
  const total = succeeded + failed;
  const allowedErrorRate = 1 - SLO_TARGETS.checkoutSuccess;
  const observedErrorRate = total === 0 ? null : failed / total;
  const consumedFraction =
    observedErrorRate === null ? null : allowedErrorRate === 0 ? 1 : observedErrorRate / allowedErrorRate;
  return {
    sloId: "checkoutSuccess",
    target: SLO_TARGETS.checkoutSuccess,
    allowedErrorRate,
    observedErrorRate,
    consumedFraction,
    remainingFraction: consumedFraction === null ? null : Math.max(0, 1 - consumedFraction),
    sampleSize: total,
  };
}
