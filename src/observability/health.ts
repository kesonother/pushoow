import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";
import { increment, observe } from "./metrics";

export type DependencyStatus = "ok" | "degraded" | "down" | "skipped";

export type DependencyCheck = {
  name: string;
  status: DependencyStatus;
  required: boolean;
  latencyMs?: number;
  detail?: string;
};

export type LivenessReport = {
  status: "ok";
  service: "pushoow";
  live: true;
  time: string;
};

export type ReadinessReport = {
  ready: boolean;
  status: "ok" | "unavailable";
  service: "pushoow";
  time: string;
  checks: DependencyCheck[];
};

export async function liveness(): Promise<LivenessReport> {
  return {
    status: "ok",
    service: "pushoow",
    live: true,
    time: new Date().toISOString(),
  };
}

export function publicLivenessPayload(report: LivenessReport = {
  status: "ok",
  service: "pushoow",
  live: true,
  time: new Date().toISOString(),
}) {
  return {
    status: report.status,
    service: report.service,
    time: report.time,
  };
}

async function checkProcess(): Promise<DependencyCheck> {
  return { name: "process", status: "ok", required: true };
}

async function checkMemory(): Promise<DependencyCheck> {
  const memory = process.memoryUsage();
  const ratio = memory.heapTotal === 0 ? 0 : memory.heapUsed / memory.heapTotal;
  return {
    name: "memory",
    status: ratio >= 0.95 ? "degraded" : "ok",
    required: false,
    detail: ratio >= 0.95 ? "heap_high" : undefined,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function checkDatabase(): Promise<DependencyCheck> {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    return {
      name: "database",
      status: env.NODE_ENV === "test" ? "skipped" : "down",
      required: env.NODE_ENV !== "test",
      detail: "DATABASE_URL is not set",
    };
  }

  const started = Date.now();
  try {
    await withTimeout(getDb().execute(sql`select 1`), 1500);
    const latencyMs = Date.now() - started;
    increment("db.queries");
    observe("db.latency_ms", latencyMs);
    return { name: "database", status: "ok", required: true, latencyMs };
  } catch {
    const latencyMs = Date.now() - started;
    increment("db.errors");
    observe("db.latency_ms", latencyMs);
    return { name: "database", status: "down", required: true, latencyMs, detail: "unreachable" };
  }
}

async function checkQueue(): Promise<DependencyCheck> {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    return { name: "queue", status: "skipped", required: false, detail: "database unavailable" };
  }
  return { name: "queue", status: "ok", required: false };
}

async function checkPayments(): Promise<DependencyCheck> {
  return {
    name: "payments",
    status: getEnv().STRIPE_SECRET_KEY ? "ok" : "skipped",
    required: false,
    detail: getEnv().STRIPE_SECRET_KEY ? undefined : "not_configured",
  };
}

async function checkEmail(): Promise<DependencyCheck> {
  return { name: "email", status: "skipped", required: false, detail: "provider_optional" };
}

export async function runDependencyChecks(): Promise<DependencyCheck[]> {
  return Promise.all([checkProcess(), checkMemory(), checkDatabase(), checkQueue(), checkPayments(), checkEmail()]);
}

export async function readiness(): Promise<ReadinessReport> {
  const checks = await runDependencyChecks();
  const blocked = checks.some((check) => check.required && check.status === "down");
  return {
    ready: !blocked,
    status: blocked ? "unavailable" : "ok",
    service: "pushoow",
    time: new Date().toISOString(),
    checks,
  };
}
