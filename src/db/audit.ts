import type { Database } from "@/db/client";
import { auditLog } from "@/db/schema";
import { cuidGenerator } from "@/lib/ids";

export function requestAuditContext(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    ipAddress:
      forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent"),
  };
}

export async function writeAuditLog(
  db: Database,
  input: {
    organizationId?: string | null;
    actorUserId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
    before?: unknown;
    after?: unknown;
    requestId?: string | null;
  },
) {
  await db.insert(auditLog).values({
    id: cuidGenerator.id(),
    organizationId: input.organizationId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.requestId ?? null,
    createdAt: new Date(),
  });
}
