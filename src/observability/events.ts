import { classifyRoute } from "./classify";
import { increment, observe } from "./metrics";
import { errorCodeOf, hashRef, severityForStatus, tenantFromPath } from "./refs";
import { redactValue } from "./redact";
import type { Logger } from "pino";

export function recordCheckoutStarted() {
  increment("payment.checkout_started");
}

export function recordCheckoutSucceeded() {
  increment("payment.checkout_succeeded");
}

export function recordCheckoutFailed() {
  increment("payment.checkout_failed");
}

export function recordEmailAttempt() {
  increment("email.delivery_attempted");
}

export function recordEmailSucceeded() {
  increment("email.delivery_succeeded");
}

export function recordEmailFailed() {
  increment("email.delivery_failed");
}

export function recordWebhookAttempt() {
  increment("webhook.delivery_attempted");
}

export function recordWebhookSucceeded() {
  increment("webhook.delivery_succeeded");
}

export function recordWebhookFailed() {
  increment("webhook.delivery_failed");
}

export function recordHttpRequest(input: {
  pathname: string;
  status: number;
  startedAt: number;
  requestId: string;
  userId?: string | null;
  organizationId?: string | null;
  error?: unknown;
  log: Logger;
}) {
  const routeClass = classifyRoute(input.pathname);
  const durationMs = Math.max(0, Date.now() - input.startedAt);
  increment("http.requests", { class: routeClass });
  if (input.status >= 500) increment("http.errors", { class: routeClass });
  observe("http.latency_ms", durationMs, { class: routeClass });

  const errorCode = input.error
    ? errorCodeOf(input.error)
    : input.status >= 400
      ? String(input.status)
      : undefined;
  const payload = redactValue({
    timestamp: new Date().toISOString(),
    requestId: input.requestId,
    userRef: hashRef(input.userId),
    tenantId: input.organizationId ?? tenantFromPath(input.pathname),
    service: "api",
    severity: severityForStatus(input.status),
    errorCode,
    path: input.pathname,
    status: input.status,
    durationMs,
    routeClass,
  });

  if (input.status >= 500) input.log.error(payload, "API request failed");
  else if (input.status >= 400) input.log.warn(payload, "API request rejected");
  else input.log.info(payload, "API request completed");
}
