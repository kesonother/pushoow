import { desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  statusIncident,
  statusMaintenance,
  statusUptime,
  supportTicket,
  supportTicketAssignment,
  supportTicketEvent,
  supportTicketMessage,
} from "@/db/schema/support";
import type {
  StatusIncident,
  StatusIncidentRepository,
  StatusMaintenance,
  StatusMaintenanceRepository,
  StatusUptime,
  StatusUptimeRepository,
  SupportTicket,
  SupportTicketRepository,
  TicketAssignment,
  TicketAssignmentRepository,
  TicketEvent,
  TicketEventRepository,
  TicketMessage,
  TicketMessageRepository,
} from "@/domain/support/types";

function mapTicket(row: typeof supportTicket.$inferSelect): SupportTicket {
  return {
    id: row.id,
    organizationId: row.organizationId,
    number: row.number,
    subject: row.subject,
    requesterUserId: row.requesterUserId,
    requesterEmail: row.requesterEmail ?? null,
    status: row.status,
    priority: row.priority,
    channel: row.channel,
    channelMetadata: row.channelMetadata ?? {},
    assignedToUserId: row.assignedToUserId ?? null,
    slaPolicyId: row.slaPolicyId,
    planId: row.planId,
    firstResponseDueAt: row.firstResponseDueAt,
    resolutionDueAt: row.resolutionDueAt,
    firstRespondedAt: row.firstRespondedAt ?? null,
    resolvedAt: row.resolvedAt ?? null,
    closedAt: row.closedAt ?? null,
    firstResponseBreachedAt: row.firstResponseBreachedAt ?? null,
    resolutionBreachedAt: row.resolutionBreachedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMessage(row: typeof supportTicketMessage.$inferSelect): TicketMessage {
  return {
    id: row.id,
    organizationId: row.organizationId,
    ticketId: row.ticketId,
    authorUserId: row.authorUserId ?? null,
    authorKind: row.authorKind,
    body: row.body,
    attachments: row.attachments ?? [],
    visibility: row.visibility,
    createdAt: row.createdAt,
  };
}

function mapAssignment(row: typeof supportTicketAssignment.$inferSelect): TicketAssignment {
  return {
    id: row.id,
    organizationId: row.organizationId,
    ticketId: row.ticketId,
    assigneeUserId: row.assigneeUserId,
    assignedByUserId: row.assignedByUserId,
    assignedAt: row.assignedAt,
    unassignedAt: row.unassignedAt ?? null,
  };
}

function mapEvent(row: typeof supportTicketEvent.$inferSelect): TicketEvent {
  return {
    id: row.id,
    organizationId: row.organizationId,
    ticketId: row.ticketId,
    type: row.type,
    actorUserId: row.actorUserId ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt,
  };
}

function mapIncident(row: typeof statusIncident.$inferSelect): StatusIncident {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    severity: row.severity,
    impact: row.impact,
    provider: row.provider,
    externalId: row.externalId ?? null,
    startedAt: row.startedAt,
    resolvedAt: row.resolvedAt ?? null,
    updates: (row.updates ?? []).map((item) => ({
      ...item,
      at: item.at instanceof Date ? item.at : new Date(item.at),
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMaintenance(row: typeof statusMaintenance.$inferSelect): StatusMaintenance {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    provider: row.provider,
    externalId: row.externalId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapUptime(row: typeof statusUptime.$inferSelect): StatusUptime {
  return {
    id: row.id,
    component: row.component,
    day: row.day,
    uptimeBps: row.uptimeBps,
  };
}

export function createDrizzleSupportTicketRepository(db: Database): SupportTicketRepository {
  return {
    async create(item) {
      const [row] = await db.insert(supportTicket).values(item).returning();
      return mapTicket(row!);
    },
    async save(item) {
      const [row] = await db.update(supportTicket).set(item).where(eq(supportTicket.id, item.id)).returning();
      return mapTicket(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(supportTicket).where(eq(supportTicket.id, id)).limit(1);
      return row ? mapTicket(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(supportTicket)
        .where(eq(supportTicket.organizationId, organizationId))
        .orderBy(desc(supportTicket.updatedAt));
      return rows.map(mapTicket);
    },
    async listOpen() {
      const rows = await db
        .select()
        .from(supportTicket)
        .where(inArray(supportTicket.status, ["open", "assigned", "pending"]));
      return rows.map(mapTicket);
    },
  };
}

export function createDrizzleTicketMessageRepository(db: Database): TicketMessageRepository {
  return {
    async create(item) {
      const [row] = await db.insert(supportTicketMessage).values(item).returning();
      return mapMessage(row!);
    },
    async listByTicket(ticketId) {
      const rows = await db
        .select()
        .from(supportTicketMessage)
        .where(eq(supportTicketMessage.ticketId, ticketId))
        .orderBy(supportTicketMessage.createdAt);
      return rows.map(mapMessage);
    },
  };
}

export function createDrizzleTicketAssignmentRepository(db: Database): TicketAssignmentRepository {
  return {
    async create(item) {
      const [row] = await db.insert(supportTicketAssignment).values(item).returning();
      return mapAssignment(row!);
    },
    async save(item) {
      const [row] = await db
        .update(supportTicketAssignment)
        .set(item)
        .where(eq(supportTicketAssignment.id, item.id))
        .returning();
      return mapAssignment(row!);
    },
    async listByTicket(ticketId) {
      const rows = await db
        .select()
        .from(supportTicketAssignment)
        .where(eq(supportTicketAssignment.ticketId, ticketId));
      return rows.map(mapAssignment);
    },
    async findActiveByTicket(ticketId) {
      const rows = await db
        .select()
        .from(supportTicketAssignment)
        .where(eq(supportTicketAssignment.ticketId, ticketId));
      const active = rows.find((row) => row.unassignedAt == null);
      return active ? mapAssignment(active) : null;
    },
  };
}

export function createDrizzleTicketEventRepository(db: Database): TicketEventRepository {
  return {
    async create(item) {
      const [row] = await db.insert(supportTicketEvent).values(item).returning();
      return mapEvent(row!);
    },
    async listByTicket(ticketId) {
      const rows = await db
        .select()
        .from(supportTicketEvent)
        .where(eq(supportTicketEvent.ticketId, ticketId))
        .orderBy(supportTicketEvent.createdAt);
      return rows.map(mapEvent);
    },
  };
}

export function createDrizzleStatusIncidentRepository(db: Database): StatusIncidentRepository {
  return {
    async create(item) {
      const [row] = await db.insert(statusIncident).values(item).returning();
      return mapIncident(row!);
    },
    async save(item) {
      const [row] = await db.update(statusIncident).set(item).where(eq(statusIncident.id, item.id)).returning();
      return mapIncident(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(statusIncident).where(eq(statusIncident.id, id)).limit(1);
      return row ? mapIncident(row) : null;
    },
    async findBySlug(slug) {
      const [row] = await db.select().from(statusIncident).where(eq(statusIncident.slug, slug)).limit(1);
      return row ? mapIncident(row) : null;
    },
    async list() {
      const rows = await db.select().from(statusIncident).orderBy(desc(statusIncident.startedAt));
      return rows.map(mapIncident);
    },
  };
}

export function createDrizzleStatusMaintenanceRepository(db: Database): StatusMaintenanceRepository {
  return {
    async create(item) {
      const [row] = await db.insert(statusMaintenance).values(item).returning();
      return mapMaintenance(row!);
    },
    async save(item) {
      const [row] = await db
        .update(statusMaintenance)
        .set(item)
        .where(eq(statusMaintenance.id, item.id))
        .returning();
      return mapMaintenance(row!);
    },
    async list() {
      const rows = await db.select().from(statusMaintenance).orderBy(statusMaintenance.startsAt);
      return rows.map(mapMaintenance);
    },
  };
}

export function createDrizzleStatusUptimeRepository(db: Database): StatusUptimeRepository {
  return {
    async upsert(item) {
      const [row] = await db
        .insert(statusUptime)
        .values(item)
        .onConflictDoUpdate({
          target: [statusUptime.component, statusUptime.day],
          set: { uptimeBps: item.uptimeBps },
        })
        .returning();
      return mapUptime(row!);
    },
    async listByComponent(component) {
      const rows = await db.select().from(statusUptime).where(eq(statusUptime.component, component));
      return rows.map(mapUptime);
    },
    async listAll() {
      const rows = await db.select().from(statusUptime).orderBy(statusUptime.day);
      return rows.map(mapUptime);
    },
  };
}
