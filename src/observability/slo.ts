export const SLO_WINDOW_MS = 60 * 60 * 1000;

export const SLO_TARGETS = {
  availability: 0.999,
  publicPageP95Ms: 300,
  dashboardP95Ms: 500,
  checkoutSuccess: 0.995,
} as const;

export type SloId = keyof typeof SLO_TARGETS;

export type SloEvaluation = {
  id: SloId;
  target: number;
  current: number | null;
  met: boolean | null;
  sampleSize: number;
};

export function evaluateAvailability(ok: number, total: number): SloEvaluation {
  const current = total === 0 ? null : ok / total;
  return {
    id: "availability",
    target: SLO_TARGETS.availability,
    current,
    met: current === null ? null : current >= SLO_TARGETS.availability,
    sampleSize: total,
  };
}

export function evaluateLatencyP95(id: "publicPageP95Ms" | "dashboardP95Ms", p95: number | null, sampleSize: number): SloEvaluation {
  return {
    id,
    target: SLO_TARGETS[id],
    current: p95,
    met: p95 === null ? null : p95 <= SLO_TARGETS[id],
    sampleSize,
  };
}

export function evaluateCheckoutSuccess(succeeded: number, failed: number): SloEvaluation {
  const total = succeeded + failed;
  const current = total === 0 ? null : succeeded / total;
  return {
    id: "checkoutSuccess",
    target: SLO_TARGETS.checkoutSuccess,
    current,
    met: current === null ? null : current >= SLO_TARGETS.checkoutSuccess,
    sampleSize: total,
  };
}
