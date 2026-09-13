import type { Database } from "@/db/client";
import { auditLog } from "@/db/schema";
import { cuidGenerator } from "@/lib/ids";

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
    requestId: input.requestId ?? null,
    createdAt: new Date(),
  });
}
