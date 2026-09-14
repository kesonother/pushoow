import type { PlanId } from "@/domain/billing/types";

export const SUPPORT_HUMAN_FIRST = true;
export const SUPPORT_BOT_REQUIRED = false;
export const HUMAN_FIRST_OPENING =
  "A teammate will reply. Human support is the default — no chatbot is required.";

export const TICKET_STATUSES = ["open", "assigned", "pending", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const SUPPORT_CHANNELS = ["email", "in_app", "phone", "slack"] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];

export const MESSAGE_AUTHOR_KINDS = ["requester", "agent", "system"] as const;
export type MessageAuthorKind = (typeof MESSAGE_AUTHOR_KINDS)[number];

export const MESSAGE_VISIBILITIES = ["public", "internal"] as const;
export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export const TICKET_EVENT_TYPES = [
  "opened",
  "message_added",
  "assigned",
  "unassigned",
  "status_changed",
  "priority_changed",
  "sla_breached",
  "sla_escalated",
  "resolved",
  "closed",
  "reopened",
] as const;
export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];

export const INCIDENT_STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_SEVERITIES = ["minor", "major", "critical"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const MAINTENANCE_STATUSES = ["scheduled", "in_progress", "completed"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export type TicketAttachment = {
  id?: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  url: string;
};

export type SupportChannelMetadata = {
  emailFrom?: string | null;
  emailMessageId?: string | null;
  phoneNumber?: string | null;
  callSid?: string | null;
  slackTeamId?: string | null;
  slackChannelId?: string | null;
  slackThreadTs?: string | null;
};

export type BusinessHours = {
  timezone: string;
  weekdays: number[];
  startHour: number;
  endHour: number;
};

export type SlaTargets = {
  firstResponseHours: Record<TicketPriority, number>;
  resolutionHours: Record<TicketPriority, number>;
};

export type SlaPolicy = SlaTargets & {
  id: string;
  planId: PlanId;
  aroundTheClock: boolean;
  businessHours: BusinessHours | null;
  escalateOnFirstResponseBreach: boolean;
};

export type SupportTicket = {
  id: string;
  organizationId: string;
  number: string;
  subject: string;
  requesterUserId: string;
  requesterEmail: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  channel: SupportChannel;
  channelMetadata: SupportChannelMetadata;
  assignedToUserId: string | null;
  slaPolicyId: string;
  planId: PlanId;
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  firstResponseBreachedAt: Date | null;
  resolutionBreachedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TicketMessage = {
  id: string;
  organizationId: string;
  ticketId: string;
  authorUserId: string | null;
  authorKind: MessageAuthorKind;
  body: string;
  attachments: TicketAttachment[];
  visibility: MessageVisibility;
  createdAt: Date;
};

export type TicketAssignment = {
  id: string;
  organizationId: string;
  ticketId: string;
  assigneeUserId: string;
  assignedByUserId: string;
  assignedAt: Date;
  unassignedAt: Date | null;
};

export type TicketEvent = {
  id: string;
  organizationId: string;
  ticketId: string;
  type: TicketEventType;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type StatusIncidentUpdate = {
  at: Date;
  status: IncidentStatus;
  body: string;
};

export type StatusIncident = {
  id: string;
  slug: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  impact: string;
  provider: "native" | "external";
  externalId: string | null;
  startedAt: Date;
  resolvedAt: Date | null;
  updates: StatusIncidentUpdate[];
  createdAt: Date;
  updatedAt: Date;
};

export type StatusMaintenance = {
  id: string;
  title: string;
  status: MaintenanceStatus;
  startsAt: Date;
  endsAt: Date;
  provider: "native" | "external";
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StatusUptime = {
  id: string;
  component: string;
  day: string;
  uptimeBps: number;
};

export type SupportTicketRepository = {
  create: (item: SupportTicket) => Promise<SupportTicket>;
  save: (item: SupportTicket) => Promise<SupportTicket>;
  findById: (id: string) => Promise<SupportTicket | null>;
  listByOrganization: (organizationId: string) => Promise<SupportTicket[]>;
  listOpen: () => Promise<SupportTicket[]>;
};

export type TicketMessageRepository = {
  create: (item: TicketMessage) => Promise<TicketMessage>;
  listByTicket: (ticketId: string) => Promise<TicketMessage[]>;
};

export type TicketAssignmentRepository = {
  create: (item: TicketAssignment) => Promise<TicketAssignment>;
  save: (item: TicketAssignment) => Promise<TicketAssignment>;
  listByTicket: (ticketId: string) => Promise<TicketAssignment[]>;
  findActiveByTicket: (ticketId: string) => Promise<TicketAssignment | null>;
};

export type TicketEventRepository = {
  create: (item: TicketEvent) => Promise<TicketEvent>;
  listByTicket: (ticketId: string) => Promise<TicketEvent[]>;
};

export type StatusIncidentRepository = {
  create: (item: StatusIncident) => Promise<StatusIncident>;
  save: (item: StatusIncident) => Promise<StatusIncident>;
  findById: (id: string) => Promise<StatusIncident | null>;
  findBySlug: (slug: string) => Promise<StatusIncident | null>;
  list: () => Promise<StatusIncident[]>;
};

export type StatusMaintenanceRepository = {
  create: (item: StatusMaintenance) => Promise<StatusMaintenance>;
  save: (item: StatusMaintenance) => Promise<StatusMaintenance>;
  list: () => Promise<StatusMaintenance[]>;
};

export type StatusUptimeRepository = {
  upsert: (item: StatusUptime) => Promise<StatusUptime>;
  listByComponent: (component: string) => Promise<StatusUptime[]>;
  listAll: () => Promise<StatusUptime[]>;
};

export type SupportSlaView = {
  applicable: boolean;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  aroundTheClock: boolean;
};

export type TicketConversation = {
  ticket: SupportTicket;
  sla: SupportSlaView;
  messages: TicketMessage[];
  assignments: TicketAssignment[];
  history: TicketEvent[];
};
