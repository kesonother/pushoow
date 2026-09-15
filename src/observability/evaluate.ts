import { evaluateAlerts, type FiredAlert } from "./alerts";
import { errorBudgetFromAvailability, errorBudgetFromCheckout, type ErrorBudget } from "./error-budget";
import { liveness, readiness, type ReadinessReport } from "./health";
import { metricsSnapshot, sampleCount, sum } from "./metrics";
import { evaluateAvailability, evaluateCheckoutSuccess, evaluateLatencyP95, type SloEvaluation } from "./slo";

export type ObservabilitySnapshot = {
  metrics: ReturnType<typeof metricsSnapshot>;
  slos: {
    availability: SloEvaluation;
    publicPage: SloEvaluation;
    dashboard: SloEvaluation;
    checkout: SloEvaluation;
  };
  budgets: {
    availability: ErrorBudget;
    checkout: ErrorBudget;
  };
  alerts: FiredAlert[];
  live: Awaited<ReturnType<typeof liveness>>;
  ready: ReadinessReport;
};

export async function captureObservability(now = Date.now()): Promise<ObservabilitySnapshot> {
  const metrics = metricsSnapshot(now);
  const classes = ["public_page", "dashboard", "checkout", "other"] as const;
  let ok = 0;
  let total = 0;
  for (const routeClass of classes) {
    const requests = sum("http.requests", { class: routeClass }, undefined, now);
    const errors = sum("http.errors", { class: routeClass }, undefined, now);
    total += requests;
    ok += Math.max(0, requests - errors);
  }

  const slos = {
    availability: evaluateAvailability(ok, total),
    publicPage: evaluateLatencyP95(
      "publicPageP95Ms",
      metrics.publicPageP95Ms,
      sampleCount("http.latency_ms", { class: "public_page" }, undefined, now),
    ),
    dashboard: evaluateLatencyP95(
      "dashboardP95Ms",
      metrics.dashboardP95Ms,
      sampleCount("http.latency_ms", { class: "dashboard" }, undefined, now),
    ),
    checkout: evaluateCheckoutSuccess(metrics.paymentSucceeded, metrics.paymentFailed),
  };
  const budgets = {
    availability: errorBudgetFromAvailability(ok, total),
    checkout: errorBudgetFromCheckout(metrics.paymentSucceeded, metrics.paymentFailed),
  };
  const live = await liveness();
  const ready = await readiness();
  const alerts = evaluateAlerts({
    availabilityBudget: budgets.availability,
    checkoutBudget: budgets.checkout,
    publicPage: slos.publicPage,
    dashboard: slos.dashboard,
    ready: ready.ready,
    requestCount: total,
    errorCount: Math.max(0, total - ok),
    queueDepth: metrics.queueDepth,
    webhookAttempted: metrics.webhookAttempted,
    webhookFailed: metrics.webhookFailed,
    emailAttempted: metrics.emailAttempted,
    emailFailed: metrics.emailFailed,
    heapUsedBytes: metrics.process.heapUsedBytes,
  });

  return { metrics, slos, budgets, alerts, live, ready };
}
