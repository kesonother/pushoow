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

const OPEN_STATUSES = new Set(["open", "assigned", "pending"]);

export function createMemorySupportTickets(): SupportTicketRepository {
  const items = new Map<string, SupportTicket>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByOrganization(organizationId) {
      return [...items.values()]
        .filter((item) => item.organizationId === organizationId)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    },
    async listOpen() {
      return [...items.values()].filter((item) => OPEN_STATUSES.has(item.status));
    },
  };
}

export function createMemoryTicketMessages(): TicketMessageRepository {
  const items = new Map<string, TicketMessage>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async listByTicket(ticketId) {
      return [...items.values()]
        .filter((item) => item.ticketId === ticketId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    },
  };
}

export function createMemoryTicketAssignments(): TicketAssignmentRepository {
  const items = new Map<string, TicketAssignment>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async listByTicket(ticketId) {
      return [...items.values()]
        .filter((item) => item.ticketId === ticketId)
        .sort((left, right) => left.assignedAt.getTime() - right.assignedAt.getTime());
    },
    async findActiveByTicket(ticketId) {
      return (
        [...items.values()].find((item) => item.ticketId === ticketId && item.unassignedAt === null) ?? null
      );
    },
  };
}

export function createMemoryTicketEvents(): TicketEventRepository {
  const items = new Map<string, TicketEvent>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async listByTicket(ticketId) {
      return [...items.values()]
        .filter((item) => item.ticketId === ticketId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    },
  };
}

export function createMemoryStatusIncidents(): StatusIncidentRepository {
  const items = new Map<string, StatusIncident>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findBySlug(slug) {
      return [...items.values()].find((item) => item.slug === slug) ?? null;
    },
    async list() {
      return [...items.values()].sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
    },
  };
}

export function createMemoryStatusMaintenance(): StatusMaintenanceRepository {
  const items = new Map<string, StatusMaintenance>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async list() {
      return [...items.values()].sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
    },
  };
}

export function createMemoryStatusUptime(): StatusUptimeRepository {
  const items = new Map<string, StatusUptime>();
  const keyOf = (item: Pick<StatusUptime, "component" | "day">) => `${item.component}:${item.day}`;
  return {
    async upsert(item) {
      const existing = [...items.values()].find((row) => row.component === item.component && row.day === item.day);
      const next = existing ? { ...item, id: existing.id } : item;
      items.set(keyOf(next), next);
      return next;
    },
    async listByComponent(component) {
      return [...items.values()].filter((item) => item.component === component);
    },
    async listAll() {
      return [...items.values()].sort((left, right) => left.day.localeCompare(right.day));
    },
  };
}
