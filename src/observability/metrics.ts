export type MetricName =
  | "http.requests"
  | "http.errors"
  | "http.latency_ms"
  | "db.queries"
  | "db.errors"
  | "db.latency_ms"
  | "queue.processed"
  | "queue.failed"
  | "queue.depth"
  | "payment.checkout_started"
  | "payment.checkout_succeeded"
  | "payment.checkout_failed"
  | "email.delivery_attempted"
  | "email.delivery_succeeded"
  | "email.delivery_failed"
  | "webhook.delivery_attempted"
  | "webhook.delivery_succeeded"
  | "webhook.delivery_failed"
  | "process.rss_bytes"
  | "process.heap_used_bytes"
  | "process.cpu_user_micros"
  | "process.cpu_system_micros"
  | "activation.events"
  | "referral.clicks"
  | "referral.conversions"
  | "embed.impressions";

export type LabeledSample = {
  at: number;
  value: number;
  labels?: Record<string, string>;
};

const WINDOW_MS = 60 * 60 * 1000;
const MAX_SAMPLES = 4_000;

const counters = new Map<string, number>();
const series = new Map<string, LabeledSample[]>();
let queueDepth = 0;

function keyOf(name: MetricName, labels?: Record<string, string>): string {
  if (!labels) return name;
  const suffix = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
  return suffix ? `${name}|${suffix}` : name;
}

function prune(name: string, now: number) {
  const items = series.get(name);
  if (!items) return;
  const kept = items.filter((item) => now - item.at <= WINDOW_MS).slice(-MAX_SAMPLES);
  series.set(name, kept);
}

export function resetMetrics() {
  counters.clear();
  series.clear();
  queueDepth = 0;
}

export function increment(name: MetricName, labels?: Record<string, string>, by = 1) {
  const key = keyOf(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + by);
  observe(name, by, labels);
}

export function observe(name: MetricName, value: number, labels?: Record<string, string>, at = Date.now()) {
  const key = keyOf(name, labels);
  const items = series.get(key) ?? [];
  items.push({ at, value, labels });
  series.set(key, items);
  prune(key, at);
}

export function setQueueDepth(depth: number) {
  queueDepth = Math.max(0, depth);
  observe("queue.depth", queueDepth);
}

export function getQueueDepth() {
  return queueDepth;
}

export function counterValue(name: MetricName, labels?: Record<string, string>): number {
  return counters.get(keyOf(name, labels)) ?? 0;
}

export function sum(name: MetricName, labels?: Record<string, string>, sinceMs = WINDOW_MS, now = Date.now()): number {
  const prefix = keyOf(name, labels);
  let total = 0;
  for (const [key, items] of series) {
    if (key !== prefix && !key.startsWith(`${name}|`)) continue;
    if (labels && key !== prefix) continue;
    for (const item of items) {
      if (now - item.at <= sinceMs) total += item.value;
    }
  }
  return total;
}

export function sampleCount(
  name: MetricName,
  labels?: Record<string, string>,
  sinceMs = WINDOW_MS,
  now = Date.now(),
): number {
  return (series.get(keyOf(name, labels)) ?? []).filter((item) => now - item.at <= sinceMs).length;
}

export function percentile(
  name: MetricName,
  p: number,
  labels?: Record<string, string>,
  sinceMs = WINDOW_MS,
  now = Date.now(),
): number | null {
  const items = (series.get(keyOf(name, labels)) ?? [])
    .filter((item) => now - item.at <= sinceMs)
    .map((item) => item.value)
    .sort((a, b) => a - b);
  if (items.length === 0) return null;
  const index = Math.min(items.length - 1, Math.max(0, Math.ceil((p / 100) * items.length) - 1));
  return items[index] ?? null;
}

export function sampleProcess() {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  observe("process.rss_bytes", memory.rss);
  observe("process.heap_used_bytes", memory.heapUsed);
  observe("process.cpu_user_micros", cpu.user);
  observe("process.cpu_system_micros", cpu.system);
  return {
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    cpuUserMicros: cpu.user,
    cpuSystemMicros: cpu.system,
  };
}

export function metricsSnapshot(now = Date.now()) {
  const processStats = sampleProcess();
  return {
    capturedAt: new Date(now).toISOString(),
    requestRate: sum("http.requests", undefined, WINDOW_MS, now),
    errorRate: sum("http.errors", undefined, WINDOW_MS, now),
    latencyP95Ms: percentile("http.latency_ms", 95, undefined, WINDOW_MS, now),
    publicPageP95Ms: percentile("http.latency_ms", 95, { class: "public_page" }, WINDOW_MS, now),
    dashboardP95Ms: percentile("http.latency_ms", 95, { class: "dashboard" }, WINDOW_MS, now),
    dbQueries: sum("db.queries", undefined, WINDOW_MS, now),
    dbErrors: sum("db.errors", undefined, WINDOW_MS, now),
    dbLatencyP95Ms: percentile("db.latency_ms", 95, undefined, WINDOW_MS, now),
    queueProcessed: sum("queue.processed", undefined, WINDOW_MS, now),
    queueFailed: sum("queue.failed", undefined, WINDOW_MS, now),
    queueDepth: getQueueDepth(),
    paymentStarted: counterValue("payment.checkout_started"),
    paymentSucceeded: counterValue("payment.checkout_succeeded"),
    paymentFailed: counterValue("payment.checkout_failed"),
    emailAttempted: counterValue("email.delivery_attempted"),
    emailSucceeded: counterValue("email.delivery_succeeded"),
    emailFailed: counterValue("email.delivery_failed"),
    webhookAttempted: counterValue("webhook.delivery_attempted"),
    webhookSucceeded: counterValue("webhook.delivery_succeeded"),
    webhookFailed: counterValue("webhook.delivery_failed"),
    process: processStats,
  };
}
