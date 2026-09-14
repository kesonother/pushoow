import { toCsv } from "@/domain/analytics/export";
import type { AuditLog } from "@/domain/audit/types";

function jsonCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function auditLogsToCsv(logs: AuditLog[]): string {
  return toCsv(
    logs.map((log) => ({
      actor: log.actorUserId ?? "",
      timestamp: log.createdAt.toISOString(),
      ip: log.ipAddress ?? "",
      userAgent: log.userAgent ?? "",
      action: log.action,
      target: log.resourceId ? `${log.resourceType}:${log.resourceId}` : log.resourceType,
      before: jsonCell(log.before),
      after: jsonCell(log.after),
    })),
  );
}
