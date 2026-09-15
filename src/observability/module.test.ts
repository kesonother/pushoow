import { afterEach, describe, expect, it } from "vitest";
import { evaluateAlerts } from "./alerts";
import { classifyRoute } from "./classify";
import { errorBudgetFromAvailability, errorBudgetFromCheckout } from "./error-budget";
import {
  recordCheckoutFailed,
  recordCheckoutStarted,
  recordCheckoutSucceeded,
  recordEmailFailed,
  recordEmailSucceeded,
  recordWebhookFailed,
  recordWebhookSucceeded,
} from "./events";
import { increment, observe, resetMetrics, setQueueDepth } from "./metrics";
import { redactString, redactValue } from "./redact";
import { hashRef } from "./refs";
import { SLO_TARGETS, evaluateAvailability, evaluateCheckoutSuccess, evaluateLatencyP95 } from "./slo";
import { enrichPublicStatus } from "./status-page";
import { unavailablePublicStatus } from "@/domain/support/service";
import { captureObservability } from "./evaluate";
import { liveness, publicLivenessPayload, readiness } from "./health";

afterEach(() => {
  resetMetrics();
});

describe("structured logging safeguards", () => {
  it("hashes user identifiers and redacts secrets", () => {
    expect(hashRef("user_123")).toHaveLength(16);
    expect(hashRef("user_123")).not.toBe("user_123");
    expect(hashRef("user_123")).toBe(hashRef("user_123"));
    expect(redactString("Bearer sk_live_abc123 and 4242424242424242")).toContain("[REDACTED");
    expect(
      JSON.stringify(
        redactValue({
          password: "hunter2",
          token: "tok_secret",
          cardNumber: "4242424242424242",
          clientSecret: "whsec_live_xxx",
          userId: "keep-me",
        }),
      ),
    ).not.toMatch(/hunter2|tok_secret|4242|whsec/);
  });
});

describe("route classification", () => {
  it("separates public, dashboard, checkout, and health traffic", () => {
    expect(classifyRoute("/discover")).toBe("public_page");
    expect(classifyRoute("/api/v1/status")).toBe("public_page");
    expect(classifyRoute("/dashboard/organizations/org_1")).toBe("dashboard");
    expect(classifyRoute("/api/v1/organizations/org_1/events")).toBe("dashboard");
    expect(classifyRoute("/api/v1/organizations/org_1/billing")).toBe("checkout");
    expect(classifyRoute("/api/v1/events/evt_1/register")).toBe("checkout");
    expect(classifyRoute("/api/v1/health/ready")).toBe("health");
  });
});

describe("SLOs and error budget", () => {
  it("computes remaining availability budget from the 99.9% target", () => {
    expect(SLO_TARGETS.availability).toBe(0.999);
    const slo = evaluateAvailability(999, 1000);
    expect(slo.met).toBe(true);
    const budget = errorBudgetFromAvailability(999, 1000);
    expect(budget.allowedErrorRate).toBeCloseTo(0.001);
    expect(budget.consumedFraction).toBeCloseTo(1);
    expect(budget.remainingFraction).toBeCloseTo(0);

    const healthy = errorBudgetFromAvailability(10_000, 10_000);
    expect(healthy.consumedFraction).toBe(0);
    expect(healthy.remainingFraction).toBe(1);
  });

  it("evaluates latency and checkout SLOs", () => {
    expect(evaluateLatencyP95("publicPageP95Ms", 250, 20).met).toBe(true);
    expect(evaluateLatencyP95("dashboardP95Ms", 800, 20).met).toBe(false);
    expect(evaluateCheckoutSuccess(199, 1).met).toBe(true);
    expect(errorBudgetFromCheckout(199, 1).remainingFraction).toBeGreaterThan(0);
  });
});

describe("alerting", () => {
  it("fires P1, P2, P3, and SLO-based rules from the catalog", () => {
    const fired = evaluateAlerts({
      availabilityBudget: errorBudgetFromAvailability(900, 1000),
      checkoutBudget: errorBudgetFromCheckout(90, 10),
      publicPage: evaluateLatencyP95("publicPageP95Ms", 900, 20),
      dashboard: evaluateLatencyP95("dashboardP95Ms", 900, 20),
      ready: false,
      requestCount: 1000,
      errorCount: 100,
      queueDepth: 80,
      webhookAttempted: 20,
      webhookFailed: 8,
      emailAttempted: 20,
      emailFailed: 8,
      heapUsedBytes: 600 * 1024 * 1024,
    });
    const ids = fired.map((alert) => alert.id);
    expect(ids).toContain("availability-budget-burn");
    expect(ids).toContain("checkout-success-critical");
    expect(ids).toContain("readiness-failed");
    expect(ids).toContain("http-5xx-spike");
    expect(ids).toContain("public-page-p95");
    expect(ids).toContain("dashboard-p95");
    expect(ids).toContain("queue-depth-high");
    expect(ids).toContain("webhook-delivery-degraded");
    expect(ids).toContain("memory-high");
    expect(ids).toContain("email-delivery-degraded");
    expect(fired.some((alert) => alert.severity === "P1")).toBe(true);
    expect(fired.some((alert) => alert.severity === "P2")).toBe(true);
    expect(fired.some((alert) => alert.severity === "P3")).toBe(true);
    expect(fired.some((alert) => alert.kind === "slo")).toBe(true);
  });
});

describe("health", () => {
  it("keeps liveness compatible with the public health payload", async () => {
    const live = await liveness();
    expect(publicLivenessPayload(live)).toEqual({
      status: "ok",
      service: "pushoow",
      time: live.time,
    });
    const ready = await readiness();
    expect(ready.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining(["process", "memory", "database", "queue", "payments", "email"]),
    );
    expect(ready).toHaveProperty("ready");
  });
});

describe("metrics and status page", () => {
  it("tracks product metrics and prepares public status data", async () => {
    increment("http.requests", { class: "public_page" });
    observe("http.latency_ms", 120, { class: "public_page" });
    increment("http.requests", { class: "dashboard" });
    observe("http.latency_ms", 180, { class: "dashboard" });
    recordCheckoutStarted();
    recordCheckoutSucceeded();
    recordCheckoutFailed();
    recordEmailSucceeded();
    recordEmailFailed();
    recordWebhookSucceeded();
    recordWebhookFailed();
    setQueueDepth(3);

    const observed = await captureObservability();
    expect(observed.metrics.requestRate).toBeGreaterThan(0);
    expect(observed.metrics.process.rssBytes).toBeGreaterThan(0);
    expect(observed.metrics.queueDepth).toBe(3);
    expect(observed.slos.availability.id).toBe("availability");
    expect(observed.budgets.availability.remainingFraction).not.toBeUndefined();

    const page = await enrichPublicStatus(unavailablePublicStatus());
    expect(page.status).toBe("outage");
    expect(page.components.map((item) => item.id)).toEqual([
      "api",
      "database",
      "queue",
      "payments",
      "email",
      "webhooks",
    ]);
    expect(page.slos.map((item) => item.id)).toEqual([
      "availability",
      "publicPageP95Ms",
      "dashboardP95Ms",
      "checkoutSuccess",
    ]);
    expect(JSON.stringify(page)).not.toMatch(/sk_live|password|Bearer /);
  });
});
