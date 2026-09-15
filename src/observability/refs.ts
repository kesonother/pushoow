import { createHash } from "node:crypto";

export function hashRef(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function tenantFromPath(pathname: string): string | undefined {
  const match = pathname.match(/\/organizations\/([^/]+)/);
  return match?.[1];
}

export function errorCodeOf(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "INTERNAL";
}

export type Severity = "debug" | "info" | "warn" | "error" | "fatal";

export function severityForStatus(status: number): Severity {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}
