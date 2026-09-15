import type { PublicStatusSnapshot } from "@/domain/support/service";
import { captureObservability } from "./evaluate";
import type { DependencyCheck, DependencyStatus } from "./health";
import type { SloEvaluation } from "./slo";

export type StatusComponentId = "api" | "database" | "queue" | "payments" | "email" | "webhooks";

export type StatusComponent = {
  id: StatusComponentId;
  status: "operational" | "degraded" | "outage";
};

export type StatusSloCard = {
  id: SloEvaluation["id"];
  target: number;
  current: number | null;
  met: boolean | null;
  unit: "ratio" | "ms";
};

export type EnrichedPublicStatus = PublicStatusSnapshot & {
  components: StatusComponent[];
  slos: StatusSloCard[];
};

function componentStatus(check: DependencyCheck | undefined, fallback: StatusComponent["status"]): StatusComponent["status"] {
  if (!check) return fallback;
  if (check.status === "down") return "outage";
  if (check.status === "degraded") return "degraded";
  if (check.status === "skipped") return fallback;
  return "operational";
}

function fromCheckStatus(status: DependencyStatus): StatusComponent["status"] {
  if (status === "down") return "outage";
  if (status === "degraded") return "degraded";
  return "operational";
}

function worst(left: StatusComponent["status"], right: StatusComponent["status"]): StatusComponent["status"] {
  const rank = { operational: 0, degraded: 1, outage: 2 };
  return rank[left] >= rank[right] ? left : right;
}

function sloCard(evaluation: SloEvaluation, unit: StatusSloCard["unit"]): StatusSloCard {
  return {
    id: evaluation.id,
    target: evaluation.target,
    current: evaluation.current,
    met: evaluation.met,
    unit,
  };
}

export async function enrichPublicStatus(snapshot: PublicStatusSnapshot): Promise<EnrichedPublicStatus> {
  const observed = await captureObservability();
  const checks = new Map(observed.ready.checks.map((check) => [check.name, check]));
  const unavailable = snapshot.incidents.some((incident) => incident.id === "status-unavailable");
  const pageFallback: StatusComponent["status"] =
    snapshot.status === "outage" || unavailable ? "outage" : snapshot.status === "degraded" ? "degraded" : "operational";

  const checkoutDegraded = observed.slos.checkout.met === false;
  const webhookDegraded =
    observed.metrics.webhookAttempted > 0 &&
    observed.metrics.webhookFailed / observed.metrics.webhookAttempted >= 0.1;
  const emailDegraded =
    observed.metrics.emailAttempted > 0 && observed.metrics.emailFailed / observed.metrics.emailAttempted >= 0.1;

  const api = worst(
    componentStatus(checks.get("process"), pageFallback),
    observed.slos.availability.met === false ? "degraded" : "operational",
  );

  return {
    ...snapshot,
    components: [
      { id: "api", status: unavailable ? "outage" : api },
      { id: "database", status: unavailable ? "outage" : componentStatus(checks.get("database"), pageFallback) },
      { id: "queue", status: componentStatus(checks.get("queue"), pageFallback) },
      {
        id: "payments",
        status: checkoutDegraded ? "degraded" : componentStatus(checks.get("payments"), "operational"),
      },
      {
        id: "email",
        status: emailDegraded ? "degraded" : componentStatus(checks.get("email"), "operational"),
      },
      { id: "webhooks", status: webhookDegraded ? "degraded" : fromCheckStatus("ok") },
    ],
    slos: [
      sloCard(observed.slos.availability, "ratio"),
      sloCard(observed.slos.publicPage, "ms"),
      sloCard(observed.slos.dashboard, "ms"),
      sloCard(observed.slos.checkout, "ratio"),
    ],
  };
}
