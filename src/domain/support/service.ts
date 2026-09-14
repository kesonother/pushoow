import type { EntitlementResolver } from "@/domain/billing/entitlements";
import { NotFoundError, ValidationError } from "@/domain/errors";
import type { MembershipRepository } from "@/domain/organization/types";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission, hasPermission } from "@/domain/rbac/permissions";
import {
  computeDeadlines,
  evaluateSlaTick,
  formatTicketNumber,
  slaPolicyFromEntitlements,
  slaViewFor,
} from "@/domain/support/sla";
import {
  HUMAN_FIRST_OPENING,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  MAINTENANCE_STATUSES,
  MESSAGE_VISIBILITIES,
  SUPPORT_BOT_REQUIRED,
  SUPPORT_CHANNELS,
  SUPPORT_HUMAN_FIRST,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type IncidentSeverity,
  type IncidentStatus,
  type MaintenanceStatus,
  type MessageVisibility,
  type StatusIncident,
  type StatusIncidentRepository,
  type StatusIncidentUpdate,
  type StatusMaintenance,
  type StatusMaintenanceRepository,
  type StatusUptime,
  type StatusUptimeRepository,
  type SupportChannel,
  type SupportChannelMetadata,
  type SupportTicket,
  type SupportTicketRepository,
  type TicketAssignmentRepository,
  type TicketAttachment,
  type TicketConversation,
  type TicketEvent,
  type TicketEventRepository,
  type TicketEventType,
  type TicketMessageRepository,
  type TicketPriority,
  type TicketStatus,
} from "@/domain/support/types";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export type SupportNotifier = {
  notify: (input: {
    organizationId: string;
    ticketId: string;
    templateKey: string;
    subject: string;
    body: string;
  }) => Promise<void>;
};

export type SupportServiceDeps = {
  tickets: SupportTicketRepository;
  messages: TicketMessageRepository;
  assignments: TicketAssignmentRepository;
  events: TicketEventRepository;
  incidents: StatusIncidentRepository;
  maintenance: StatusMaintenanceRepository;
  uptime: StatusUptimeRepository;
  entitlements: EntitlementResolver;
  members?: Pick<MembershipRepository, "findByUserAndOrganization">;
  notify?: SupportNotifier;
  clock?: Clock;
  ids?: IdGenerator;
};

function isPriority(value: string): value is TicketPriority {
  return (TICKET_PRIORITIES as readonly string[]).includes(value);
}

function isChannel(value: string): value is SupportChannel {
  return (SUPPORT_CHANNELS as readonly string[]).includes(value);
}

function isStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

function isVisibility(value: string): value is MessageVisibility {
  return (MESSAGE_VISIBILITIES as readonly string[]).includes(value);
}

function parseAttachments(raw: TicketAttachment[] | undefined): TicketAttachment[] {
  if (!raw?.length) return [];
  if (raw.length > 10) throw new ValidationError("A ticket may include at most 10 attachments");
  return raw.map((item, index) => {
    if (!item.filename?.trim() || !item.contentType?.trim() || !item.url?.trim()) {
      throw new ValidationError(`Attachment ${index + 1} is incomplete`);
    }
    if (!/^https?:\/\//i.test(item.url)) {
      throw new ValidationError("Attachment URLs must be http(s)");
    }
    if (!Number.isFinite(item.sizeBytes) || item.sizeBytes <= 0 || item.sizeBytes > 20_000_000) {
      throw new ValidationError("Attachment size is invalid");
    }
    return {
      id: item.id?.trim() || `att_${index + 1}`,
      filename: item.filename.trim(),
      contentType: item.contentType.trim(),
      sizeBytes: Math.floor(item.sizeBytes),
      url: item.url.trim(),
    };
  });
}

function parseChannelMetadata(
  channel: SupportChannel,
  raw: SupportChannelMetadata | undefined,
): SupportChannelMetadata {
  const metadata = raw ?? {};
  if (channel === "email") {
    return {
      emailFrom: metadata.emailFrom?.trim() || null,
      emailMessageId: metadata.emailMessageId?.trim() || null,
    };
  }
  if (channel === "phone") {
    return {
      phoneNumber: metadata.phoneNumber?.trim() || null,
      callSid: metadata.callSid?.trim() || null,
    };
  }
  if (channel === "slack") {
    return {
      slackTeamId: metadata.slackTeamId?.trim() || null,
      slackChannelId: metadata.slackChannelId?.trim() || null,
      slackThreadTs: metadata.slackThreadTs?.trim() || null,
    };
  }
  return {};
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "incident";
}

export type PublicStatusSnapshot = {
  status: "operational" | "degraded" | "outage" | "maintenance";
  incidents: StatusIncident[];
  historicalIncidents: StatusIncident[];
  maintenance: StatusMaintenance[];
  uptime: StatusUptime[];
};

export function unavailablePublicStatus(now = new Date()): PublicStatusSnapshot {
  return {
    status: "outage",
    incidents: [
      {
        id: "status-unavailable",
        slug: "status-unavailable",
        title: "Status datastore unreachable",
        status: "investigating",
        severity: "critical",
        impact: "Live incident and uptime data cannot be loaded.",
        provider: "native",
        externalId: null,
        startedAt: now,
        resolvedAt: null,
        updates: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    historicalIncidents: [],
    maintenance: [],
    uptime: [],
  };
}

export function createSupportService(deps: SupportServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function policyFor(organizationId: string) {
    const entitlements = await deps.entitlements.forOrganization(organizationId);
    return {
      entitlements,
      policy: slaPolicyFromEntitlements(entitlements.planId, entitlements.supportSlaHours),
    };
  }

  async function recordEvent(input: {
    organizationId: string;
    ticketId: string;
    type: TicketEventType;
    actorUserId: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<TicketEvent> {
    return deps.events.create({
      id: ids.id(),
      organizationId: input.organizationId,
      ticketId: input.ticketId,
      type: input.type,
      actorUserId: input.actorUserId,
      metadata: input.metadata ?? {},
      createdAt: clock.now(),
    });
  }

  async function requireTicket(actor: Actor, ticketId: string): Promise<SupportTicket> {
    const ticket = await deps.tickets.findById(ticketId);
    assertSameTenant(ticket, actor.organizationId, "SupportTicket");
    return ticket;
  }

  async function conversationFor(actor: Actor, ticket: SupportTicket): Promise<TicketConversation> {
    const { policy } = await policyFor(ticket.organizationId);
    const includeInternal = hasPermission(actor, "support:manage");
    const messages = (await deps.messages.listByTicket(ticket.id)).filter(
      (item) => includeInternal || item.visibility === "public",
    );
    return {
      ticket,
      sla: slaViewFor(ticket, clock.now(), policy.aroundTheClock),
      messages,
      assignments: await deps.assignments.listByTicket(ticket.id),
      history: await deps.events.listByTicket(ticket.id),
    };
  }

  async function createTicket(
    actor: Actor,
    input: {
      subject: string;
      body: string;
      priority?: string;
      channel?: string;
      channelMetadata?: SupportChannelMetadata;
      attachments?: TicketAttachment[];
      requesterEmail?: string | null;
    },
  ): Promise<TicketConversation> {
    assertPermission(actor, "support:write");
    if (SUPPORT_BOT_REQUIRED) {
      throw new ValidationError("Mandatory chatbot support is not enabled");
    }
    const subject = input.subject?.trim() ?? "";
    const body = input.body?.trim() ?? "";
    if (subject.length < 3 || subject.length > 160) {
      throw new ValidationError("Subject must be between 3 and 160 characters");
    }
    if (body.length < 1 || body.length > 8_000) {
      throw new ValidationError("Message body is required");
    }
    const priority = input.priority ?? "normal";
    if (!isPriority(priority)) throw new ValidationError("Invalid ticket priority");
    const channel = input.channel ?? "in_app";
    if (!isChannel(channel)) throw new ValidationError("Invalid support channel");

    const now = clock.now();
    const { entitlements, policy } = await policyFor(actor.organizationId);
    const deadlines = computeDeadlines({ from: now, priority, policy });
    const existing = await deps.tickets.listByOrganization(actor.organizationId);
    const year = now.getUTCFullYear();
    const sequence = existing.filter((item) => item.number.startsWith(`SUP-${year}-`)).length + 1;

    const ticket = await deps.tickets.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      number: formatTicketNumber(year, sequence),
      subject,
      requesterUserId: actor.userId,
      requesterEmail: input.requesterEmail?.trim() || null,
      status: "open",
      priority,
      channel,
      channelMetadata: parseChannelMetadata(channel, input.channelMetadata),
      assignedToUserId: null,
      slaPolicyId: policy.id,
      planId: entitlements.planId,
      firstResponseDueAt: deadlines.firstResponseDueAt,
      resolutionDueAt: deadlines.resolutionDueAt,
      firstRespondedAt: null,
      resolvedAt: null,
      closedAt: null,
      firstResponseBreachedAt: null,
      resolutionBreachedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await deps.messages.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      ticketId: ticket.id,
      authorUserId: actor.userId,
      authorKind: "requester",
      body,
      attachments: parseAttachments(input.attachments),
      visibility: "public",
      createdAt: now,
    });

    if (SUPPORT_HUMAN_FIRST) {
      await deps.messages.create({
        id: ids.id(),
        organizationId: actor.organizationId,
        ticketId: ticket.id,
        authorUserId: null,
        authorKind: "system",
        body: HUMAN_FIRST_OPENING,
        attachments: [],
        visibility: "public",
        createdAt: now,
      });
    }

    await recordEvent({
      organizationId: actor.organizationId,
      ticketId: ticket.id,
      type: "opened",
      actorUserId: actor.userId,
      metadata: { channel, priority, humanFirst: SUPPORT_HUMAN_FIRST, botRequired: SUPPORT_BOT_REQUIRED },
    });
    await recordEvent({
      organizationId: actor.organizationId,
      ticketId: ticket.id,
      type: "message_added",
      actorUserId: actor.userId,
      metadata: { authorKind: "requester" },
    });

    await deps.notify?.notify({
      organizationId: actor.organizationId,
      ticketId: ticket.id,
      templateKey: "support_ticket_opened",
      subject: `Support ${ticket.number}: ${ticket.subject}`,
      body: body.slice(0, 500),
    });

    return conversationFor(actor, ticket);
  }

  async function listTickets(actor: Actor): Promise<TicketConversation["ticket"][]> {
    assertPermission(actor, "support:read");
    return deps.tickets.listByOrganization(actor.organizationId);
  }

  async function getConversation(actor: Actor, ticketId: string): Promise<TicketConversation> {
    assertPermission(actor, "support:read");
    const ticket = await requireTicket(actor, ticketId);
    return conversationFor(actor, ticket);
  }

  async function addMessage(
    actor: Actor,
    ticketId: string,
    input: {
      body: string;
      visibility?: string;
      attachments?: TicketAttachment[];
      authorKind?: "requester" | "agent";
    },
  ): Promise<TicketConversation> {
    const ticket = await requireTicket(actor, ticketId);
    const visibility = input.visibility ?? "public";
    if (!isVisibility(visibility)) throw new ValidationError("Invalid message visibility");
    const body = input.body?.trim() ?? "";
    if (body.length < 1 || body.length > 8_000) {
      throw new ValidationError("Message body is required");
    }

    const wantsInternal = visibility === "internal";
    let authorKind: "requester" | "agent" = "requester";
    if (wantsInternal || input.authorKind === "agent") {
      assertPermission(actor, "support:manage");
      authorKind = "agent";
    } else if (input.authorKind === "requester") {
      assertPermission(actor, "support:write");
    } else if (hasPermission(actor, "support:manage")) {
      authorKind = "agent";
    } else {
      assertPermission(actor, "support:write");
    }

    const now = clock.now();
    await deps.messages.create({
      id: ids.id(),
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      authorUserId: actor.userId,
      authorKind,
      body,
      attachments: parseAttachments(input.attachments),
      visibility,
      createdAt: now,
    });

    let next = { ...ticket, updatedAt: now };
    if (authorKind === "agent" && visibility === "public" && !ticket.firstRespondedAt) {
      next = { ...next, firstRespondedAt: now };
    }
    if (authorKind === "requester" && ticket.status === "pending") {
      next = { ...next, status: ticket.assignedToUserId ? "assigned" : "open" };
      await recordEvent({
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        type: "status_changed",
        actorUserId: actor.userId,
        metadata: { from: ticket.status, to: next.status },
      });
    }

    await deps.tickets.save(next);
    await recordEvent({
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      type: "message_added",
      actorUserId: actor.userId,
      metadata: { authorKind, visibility },
    });

    if (authorKind === "requester") {
      await deps.notify?.notify({
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        templateKey: "support_ticket_reply",
        subject: `Support ${ticket.number}: new reply`,
        body: body.slice(0, 500),
      });
    }

    return conversationFor(actor, next);
  }

  async function assign(actor: Actor, ticketId: string, assigneeUserId: string): Promise<TicketConversation> {
    assertPermission(actor, "support:manage");
    const ticket = await requireTicket(actor, ticketId);
    if (!assigneeUserId.trim()) throw new ValidationError("Assignee is required");
    if (deps.members) {
      const member = await deps.members.findByUserAndOrganization(assigneeUserId, actor.organizationId);
      if (!member) throw new ValidationError("Assignee must belong to the organization");
    }

    const now = clock.now();
    const active = await deps.assignments.findActiveByTicket(ticket.id);
    if (active) {
      await deps.assignments.save({ ...active, unassignedAt: now });
      await recordEvent({
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        type: "unassigned",
        actorUserId: actor.userId,
        metadata: { assigneeUserId: active.assigneeUserId },
      });
    }

    await deps.assignments.create({
      id: ids.id(),
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      assigneeUserId,
      assignedByUserId: actor.userId,
      assignedAt: now,
      unassignedAt: null,
    });

    const next: SupportTicket = {
      ...ticket,
      assignedToUserId: assigneeUserId,
      status: ticket.status === "closed" || ticket.status === "resolved" ? ticket.status : "assigned",
      updatedAt: now,
    };
    await deps.tickets.save(next);
    await recordEvent({
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      type: "assigned",
      actorUserId: actor.userId,
      metadata: { assigneeUserId },
    });
    if (next.status !== ticket.status) {
      await recordEvent({
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        type: "status_changed",
        actorUserId: actor.userId,
        metadata: { from: ticket.status, to: next.status },
      });
    }
    return conversationFor(actor, next);
  }

  async function setStatus(actor: Actor, ticketId: string, status: string): Promise<TicketConversation> {
    assertPermission(actor, "support:manage");
    if (!isStatus(status)) throw new ValidationError("Invalid ticket status");
    const ticket = await requireTicket(actor, ticketId);
    if (ticket.status === status) return conversationFor(actor, ticket);

    const now = clock.now();
    let next: SupportTicket = { ...ticket, status, updatedAt: now };

    if (status === "pending" && (ticket.status === "open" || ticket.status === "assigned")) {
      next = { ...next, status: "pending" };
    } else if (status === "resolved" && (ticket.status === "open" || ticket.status === "assigned" || ticket.status === "pending")) {
      next = { ...next, status: "resolved", resolvedAt: now };
    } else if (status === "closed" && ticket.status === "resolved") {
      next = { ...next, status: "closed", closedAt: now };
    } else if (status === "open" && (ticket.status === "resolved" || ticket.status === "closed")) {
      const { entitlements, policy } = await policyFor(ticket.organizationId);
      const deadlines = computeDeadlines({ from: now, priority: ticket.priority, policy });
      next = {
        ...next,
        status: "open",
        resolvedAt: null,
        closedAt: null,
        firstRespondedAt: null,
        firstResponseBreachedAt: null,
        resolutionBreachedAt: null,
        slaPolicyId: policy.id,
        planId: entitlements.planId,
        firstResponseDueAt: deadlines.firstResponseDueAt,
        resolutionDueAt: deadlines.resolutionDueAt,
        updatedAt: now,
      };
    } else if (status === "assigned" && ticket.assignedToUserId && (ticket.status === "open" || ticket.status === "pending")) {
      next = { ...next, status: "assigned" };
    } else {
      throw new ValidationError(`Cannot move ticket from ${ticket.status} to ${status}`);
    }

    await deps.tickets.save(next);
    await recordEvent({
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      type: status === "open" && (ticket.status === "resolved" || ticket.status === "closed") ? "reopened" : "status_changed",
      actorUserId: actor.userId,
      metadata: { from: ticket.status, to: next.status },
    });
    if (next.status === "resolved") {
      await recordEvent({
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        type: "resolved",
        actorUserId: actor.userId,
      });
    }
    if (next.status === "closed") {
      await recordEvent({
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        type: "closed",
        actorUserId: actor.userId,
      });
    }
    return conversationFor(actor, next);
  }

  async function setPriority(actor: Actor, ticketId: string, priority: string): Promise<TicketConversation> {
    assertPermission(actor, "support:manage");
    if (!isPriority(priority)) throw new ValidationError("Invalid ticket priority");
    const ticket = await requireTicket(actor, ticketId);
    if (ticket.priority === priority) return conversationFor(actor, ticket);
    const now = clock.now();
    let next: SupportTicket = { ...ticket, priority, updatedAt: now };
    if (!ticket.firstRespondedAt) {
      const { policy } = await policyFor(ticket.organizationId);
      const deadlines = computeDeadlines({ from: ticket.createdAt, priority, policy });
      next = { ...next, firstResponseDueAt: deadlines.firstResponseDueAt, resolutionDueAt: deadlines.resolutionDueAt };
    }
    await deps.tickets.save(next);
    await recordEvent({
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      type: "priority_changed",
      actorUserId: actor.userId,
      metadata: { from: ticket.priority, to: priority },
    });
    return conversationFor(actor, next);
  }

  async function processSlaTick(): Promise<number> {
    const open = await deps.tickets.listOpen();
    const now = clock.now();
    let updated = 0;
    for (const ticket of open) {
      const { policy } = await policyFor(ticket.organizationId);
      const result = evaluateSlaTick(ticket, now, policy);
      if (!result.changed) continue;
      await deps.tickets.save(result.ticket);
      for (const event of result.events) {
        await recordEvent({
          organizationId: ticket.organizationId,
          ticketId: ticket.id,
          type: event.type,
          actorUserId: null,
          metadata: event.metadata,
        });
      }
      updated += 1;
    }
    return updated;
  }

  function overallStatus(input: {
    incidents: StatusIncident[];
    maintenance: StatusMaintenance[];
  }): "operational" | "degraded" | "outage" | "maintenance" {
    const active = input.incidents.filter((item) => item.status !== "resolved");
    if (active.some((item) => item.severity === "critical")) return "outage";
    if (input.maintenance.some((item) => item.status === "in_progress")) return "maintenance";
    if (active.some((item) => item.severity === "major" || item.severity === "minor")) return "degraded";
    return "operational";
  }

  async function publicStatus() {
    const incidents = await deps.incidents.list();
    const maintenance = await deps.maintenance.list();
    const uptime = await deps.uptime.listAll();
    const activeIncidents = incidents.filter((item) => item.status !== "resolved");
    const historicalIncidents = incidents.filter((item) => item.status === "resolved");
    return {
      status: overallStatus({ incidents, maintenance }),
      incidents: activeIncidents,
      historicalIncidents,
      maintenance,
      uptime,
    } satisfies PublicStatusSnapshot;
  }

  async function recordIncident(input: {
    title: string;
    impact: string;
    severity?: string;
    status?: string;
    slug?: string;
    provider?: "native" | "external";
    externalId?: string | null;
    startedAt?: Date;
  }): Promise<StatusIncident> {
    const title = input.title.trim();
    const impact = input.impact.trim();
    if (!title || !impact) throw new ValidationError("Incident title and impact are required");
    const severity = input.severity ?? "minor";
    const status = input.status ?? "investigating";
    if (!(INCIDENT_SEVERITIES as readonly string[]).includes(severity)) {
      throw new ValidationError("Invalid incident severity");
    }
    if (!(INCIDENT_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationError("Invalid incident status");
    }
    const now = clock.now();
    let slug = slugify(input.slug ?? title);
    if (await deps.incidents.findBySlug(slug)) slug = `${slug}-${ids.id().slice(0, 6)}`;
    return deps.incidents.create({
      id: ids.id(),
      slug,
      title,
      status: status as IncidentStatus,
      severity: severity as IncidentSeverity,
      impact,
      provider: input.provider ?? "native",
      externalId: input.externalId ?? null,
      startedAt: input.startedAt ?? now,
      resolvedAt: status === "resolved" ? now : null,
      updates: [{ at: now, status: status as IncidentStatus, body: impact }],
      createdAt: now,
      updatedAt: now,
    });
  }

  async function updateIncident(
    incidentId: string,
    input: { status: string; body: string },
  ): Promise<StatusIncident> {
    const incident = await deps.incidents.findById(incidentId);
    if (!incident) throw new NotFoundError("StatusIncident", incidentId);
    if (!(INCIDENT_STATUSES as readonly string[]).includes(input.status)) {
      throw new ValidationError("Invalid incident status");
    }
    const body = input.body.trim();
    if (!body) throw new ValidationError("Update body is required");
    const now = clock.now();
    const status = input.status as IncidentStatus;
    const update: StatusIncidentUpdate = { at: now, status, body };
    return deps.incidents.save({
      ...incident,
      status,
      resolvedAt: status === "resolved" ? now : incident.resolvedAt,
      updates: [...incident.updates, update],
      updatedAt: now,
    });
  }

  async function scheduleMaintenance(input: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    status?: string;
    provider?: "native" | "external";
    externalId?: string | null;
  }): Promise<StatusMaintenance> {
    const title = input.title.trim();
    if (!title) throw new ValidationError("Maintenance title is required");
    if (input.endsAt.getTime() <= input.startsAt.getTime()) {
      throw new ValidationError("Maintenance must end after it starts");
    }
    const status = input.status ?? "scheduled";
    if (!(MAINTENANCE_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationError("Invalid maintenance status");
    }
    const now = clock.now();
    return deps.maintenance.create({
      id: ids.id(),
      title,
      status: status as MaintenanceStatus,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      provider: input.provider ?? "native",
      externalId: input.externalId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function recordUptime(input: { component: string; day: string; uptimeBps: number }): Promise<StatusUptime> {
    const component = input.component.trim();
    if (!component) throw new ValidationError("Uptime component is required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) throw new ValidationError("Uptime day must be YYYY-MM-DD");
    if (!Number.isInteger(input.uptimeBps) || input.uptimeBps < 0 || input.uptimeBps > 10_000) {
      throw new ValidationError("Uptime must be between 0 and 10000 bps");
    }
    return deps.uptime.upsert({
      id: ids.id(),
      component,
      day: input.day,
      uptimeBps: input.uptimeBps,
    });
  }

  return {
    createTicket,
    listTickets,
    getConversation,
    addMessage,
    assign,
    setStatus,
    setPriority,
    processSlaTick,
    publicStatus,
    recordIncident,
    updateIncident,
    scheduleMaintenance,
    recordUptime,
  };
}
