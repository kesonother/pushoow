import { auditLogsToCsv } from "@/domain/audit/csv";
import type { AuditLog, AuditRepository, AuditWriteInput } from "@/domain/audit/types";
import type { OrganizationRepository } from "@/domain/organization/types";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export type AuditServiceDeps = {
  audit: AuditRepository;
  organizations: Pick<OrganizationRepository, "listRetentionPolicies">;
  clock?: Clock;
  ids?: IdGenerator;
};

export function createAuditService(deps: AuditServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function record(input: AuditWriteInput): Promise<AuditLog> {
    return deps.audit.create({
      id: ids.id(),
      organizationId: input.organizationId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      requestId: input.requestId ?? null,
      createdAt: clock.now(),
    });
  }

  async function list(actor: Actor): Promise<AuditLog[]> {
    assertPermission(actor, "audit:read");
    const logs = await deps.audit.listByOrganization(actor.organizationId);
    return logs.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async function exportCsv(actor: Actor): Promise<string> {
    assertPermission(actor, "audit:read");
    assertPermission(actor, "exports:create");
    const logs = await list(actor);
    return auditLogsToCsv(logs);
  }

  async function purgeExpired(): Promise<number> {
    const policies = await deps.organizations.listRetentionPolicies();
    return deps.audit.purgeExpired(
      clock.now(),
      policies.map((item) => ({
        organizationId: item.id,
        retentionDays: item.auditRetentionDays,
      })),
    );
  }

  return { record, list, exportCsv, purgeExpired };
}
