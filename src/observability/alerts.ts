import type { ErrorBudget } from "./error-budget";
import type { SloEvaluation } from "./slo";

export type AlertSeverity = "P1" | "P2" | "P3";

export type AlertRule = {
  id: string;
  severity: AlertSeverity;
  kind: "threshold" | "slo";
  title: string;
  description: string;
};

export type FiredAlert = AlertRule & {
  reason: string;
};

export const ALERT_CATALOG: AlertRule[] = [
  {
    id: "availability-budget-burn",
    severity: "P1",
    kind: "slo",
    title: "Availability error budget is burning",
    description: "More than half of the hourly availability budget is already consumed.",
  },
  {
    id: "checkout-success-critical",
    severity: "P1",
    kind: "slo",
    title: "Checkout success is critically low",
    description: "Paid checkout success dropped below the P1 floor.",
  },
  {
    id: "readiness-failed",
    severity: "P1",
    kind: "threshold",
    title: "Readiness check failed",
    description: "A required dependency is not ready.",
  },
  {
    id: "http-5xx-spike",
    severity: "P1",
    kind: "threshold",
    title: "HTTP 5xx spike",
    description: "Server error rate exceeded the P1 threshold.",
  },
  {
    id: "public-page-p95",
    severity: "P2",
    kind: "slo",
    title: "Public page latency missed its SLO",
    description: "Public page P95 exceeded the 300ms target.",
  },
  {
    id: "dashboard-p95",
    severity: "P2",
    kind: "slo",
    title: "Dashboard latency missed its SLO",
    description: "Dashboard P95 exceeded the 500ms target.",
  },
  {
    id: "http-error-rate",
    severity: "P2",
    kind: "threshold",
    title: "HTTP error rate is elevated",
    description: "Client or server errors exceeded 1% of requests.",
  },
  {
    id: "queue-depth-high",
    severity: "P2",
    kind: "threshold",
    title: "Background queue is backing up",
    description: "Pending job depth is above the operational threshold.",
  },
  {
    id: "webhook-delivery-degraded",
    severity: "P2",
    kind: "threshold",
    title: "Webhook delivery is degraded",
    description: "Webhook failure rate exceeded the P2 floor.",
  },
  {
    id: "availability-budget-warning",
    severity: "P3",
    kind: "slo",
    title: "Availability error budget warning",
    description: "Between 20% and 50% of the hourly availability budget is consumed.",
  },
  {
    id: "memory-high",
    severity: "P3",
    kind: "threshold",
    title: "Process memory is high",
    description: "Heap usage crossed the warning threshold.",
  },
  {
    id: "email-delivery-degraded",
    severity: "P3",
    kind: "threshold",
    title: "Email delivery is degraded",
    description: "Transactional email failure rate exceeded the P3 floor.",
  },
];

export type AlertEvaluationInput = {
  availabilityBudget: ErrorBudget;
  checkoutBudget: ErrorBudget;
  publicPage: SloEvaluation;
  dashboard: SloEvaluation;
  ready: boolean;
  requestCount: number;
  errorCount: number;
  queueDepth: number;
  webhookAttempted: number;
  webhookFailed: number;
  emailAttempted: number;
  emailFailed: number;
  heapUsedBytes: number;
};

function rule(id: string): AlertRule {
  const found = ALERT_CATALOG.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown alert ${id}`);
  return found;
}

export function evaluateAlerts(input: AlertEvaluationInput): FiredAlert[] {
  const fired: FiredAlert[] = [];
  const requestErrorRate = input.requestCount === 0 ? 0 : input.errorCount / input.requestCount;
  const webhookFailRate = input.webhookAttempted === 0 ? 0 : input.webhookFailed / input.webhookAttempted;
  const emailFailRate = input.emailAttempted === 0 ? 0 : input.emailFailed / input.emailAttempted;

  if ((input.availabilityBudget.consumedFraction ?? 0) >= 0.5 && (input.availabilityBudget.sampleSize ?? 0) >= 20) {
    fired.push({ ...rule("availability-budget-burn"), reason: "Hourly availability budget consumed ≥ 50%." });
  }
  if ((input.checkoutBudget.observedErrorRate ?? 0) > 0.05 && (input.checkoutBudget.sampleSize ?? 0) >= 5) {
    fired.push({ ...rule("checkout-success-critical"), reason: "Checkout success fell below 95%." });
  }
  if (!input.ready) {
    fired.push({ ...rule("readiness-failed"), reason: "Readiness endpoint reports not ready." });
  }
  if (requestErrorRate >= 0.05 && input.requestCount >= 20) {
    fired.push({ ...rule("http-5xx-spike"), reason: `HTTP error rate is ${(requestErrorRate * 100).toFixed(1)}%.` });
  }
  if (input.publicPage.met === false && input.publicPage.sampleSize >= 10) {
    fired.push({ ...rule("public-page-p95"), reason: `Public P95 is ${input.publicPage.current}ms.` });
  }
  if (input.dashboard.met === false && input.dashboard.sampleSize >= 10) {
    fired.push({ ...rule("dashboard-p95"), reason: `Dashboard P95 is ${input.dashboard.current}ms.` });
  }
  if (requestErrorRate >= 0.01 && requestErrorRate < 0.05 && input.requestCount >= 20) {
    fired.push({ ...rule("http-error-rate"), reason: `HTTP error rate is ${(requestErrorRate * 100).toFixed(1)}%.` });
  }
  if (input.queueDepth >= 50) {
    fired.push({ ...rule("queue-depth-high"), reason: `Queue depth is ${input.queueDepth}.` });
  }
  if (webhookFailRate >= 0.1 && input.webhookAttempted >= 10) {
    fired.push({ ...rule("webhook-delivery-degraded"), reason: `Webhook failure rate is ${(webhookFailRate * 100).toFixed(1)}%.` });
  }
  if (
    (input.availabilityBudget.consumedFraction ?? 0) >= 0.2 &&
    (input.availabilityBudget.consumedFraction ?? 0) < 0.5 &&
    (input.availabilityBudget.sampleSize ?? 0) >= 20
  ) {
    fired.push({ ...rule("availability-budget-warning"), reason: "Hourly availability budget consumed ≥ 20%." });
  }
  if (input.heapUsedBytes >= 512 * 1024 * 1024) {
    fired.push({ ...rule("memory-high"), reason: "Heap used exceeded 512 MiB." });
  }
  if (emailFailRate >= 0.1 && input.emailAttempted >= 10) {
    fired.push({ ...rule("email-delivery-degraded"), reason: `Email failure rate is ${(emailFailRate * 100).toFixed(1)}%.` });
  }
  return fired;
}
