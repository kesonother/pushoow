export type AuditLog = {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  before: unknown;
  after: unknown;
  requestId: string | null;
  createdAt: Date;
};

export type AuditWriteInput = {
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
};

export type AuditRepository = {
  create: (log: AuditLog) => Promise<AuditLog>;
  listByOrganization: (organizationId: string) => Promise<AuditLog[]>;
  purgeExpired: (
    now: Date,
    policies: Array<{ organizationId: string; retentionDays: number }>,
  ) => Promise<number>;
};
