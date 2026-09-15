import pino from "pino";
import { LOGGER_REDACT_PATHS } from "@/observability/redact";
import { hashRef } from "@/observability/refs";
import { getEnv } from "@/lib/env";

export const logger = pino({
  level: getEnv().LOG_LEVEL,
  base: { service: "pushoow" },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  redact: {
    paths: [...LOGGER_REDACT_PATHS],
    remove: true,
  },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

export function requestLogger(input: {
  requestId?: string;
  userId?: string | null;
  tenantId?: string | null;
  service?: string;
  errorCode?: string;
  path?: string;
}) {
  return childLogger({
    requestId: input.requestId,
    userRef: hashRef(input.userId),
    tenantId: input.tenantId ?? undefined,
    service: input.service ?? "pushoow",
    errorCode: input.errorCode,
    path: input.path,
  });
}
