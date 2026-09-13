import pino from "pino";
import { getEnv } from "@/lib/env";

export const logger = pino({
  level: getEnv().LOG_LEVEL,
  base: { service: "pushoow" },
  redact: {
    paths: [
      "password",
      "email",
      "headers.authorization",
      "headers.cookie",
      "*.password",
      "*.token",
      "*.secret",
    ],
    remove: true,
  },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
