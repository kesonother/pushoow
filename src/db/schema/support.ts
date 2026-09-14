import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import type { PlanId } from "@/domain/billing/types";
import type {
  IncidentSeverity,
  IncidentStatus,
  MaintenanceStatus,
  MessageAuthorKind,
  MessageVisibility,
  StatusIncidentUpdate,
  SupportChannel,
  SupportChannelMetadata,
  TicketAttachment,
  TicketEventType,
  TicketPriority,
  TicketStatus,
} from "@/domain/support/types";

export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "open",
  "assigned",
  "pending",
  "resolved",
  "closed",
]);
export const supportTicketPriorityEnum = pgEnum("support_ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);
export const supportChannelEnum = pgEnum("support_channel", ["email", "in_app", "phone", "slack"]);
export const supportMessageAuthorEnum = pgEnum("support_message_author", ["requester", "agent", "system"]);
export const supportMessageVisibilityEnum = pgEnum("support_message_visibility", ["public", "internal"]);
export const supportTicketEventTypeEnum = pgEnum("support_ticket_event_type", [
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
]);
export const statusIncidentStatusEnum = pgEnum("status_incident_status", [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);
export const statusIncidentSeverityEnum = pgEnum("status_incident_severity", ["minor", "major", "critical"]);
export const statusMaintenanceStatusEnum = pgEnum("status_maintenance_status", [
  "scheduled",
  "in_progress",
  "completed",
]);
export const statusPageProviderEnum = pgEnum("status_page_provider", ["native", "external"]);

export const supportTicket = pgTable(
  "support_ticket",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    subject: text("subject").notNull(),
    requesterUserId: text("requester_user_id").notNull(),
    requesterEmail: text("requester_email"),
    status: supportTicketStatusEnum("status").$type<TicketStatus>().notNull(),
    priority: supportTicketPriorityEnum("priority").$type<TicketPriority>().notNull(),
    channel: supportChannelEnum("channel").$type<SupportChannel>().notNull(),
    channelMetadata: jsonb("channel_metadata").$type<SupportChannelMetadata>().notNull().default({}),
    assignedToUserId: text("assigned_to_user_id"),
    slaPolicyId: text("sla_policy_id").notNull(),
    planId: text("plan_id").$type<PlanId>().notNull(),
    firstResponseDueAt: timestamp("first_response_due_at", { withTimezone: true, mode: "date" }).notNull(),
    resolutionDueAt: timestamp("resolution_due_at", { withTimezone: true, mode: "date" }).notNull(),
    firstRespondedAt: timestamp("first_responded_at", { withTimezone: true, mode: "date" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    firstResponseBreachedAt: timestamp("first_response_breached_at", { withTimezone: true, mode: "date" }),
    resolutionBreachedAt: timestamp("resolution_breached_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("support_ticket_number_unique").on(table.number),
    index("support_ticket_org_idx").on(table.organizationId),
    index("support_ticket_status_idx").on(table.status),
    index("support_ticket_first_response_due_idx").on(table.firstResponseDueAt),
    index("support_ticket_resolution_due_idx").on(table.resolutionDueAt),
  ],
);

export const supportTicketMessage = pgTable(
  "support_ticket_message",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTicket.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id"),
    authorKind: supportMessageAuthorEnum("author_kind").$type<MessageAuthorKind>().notNull(),
    body: text("body").notNull(),
    attachments: jsonb("attachments").$type<TicketAttachment[]>().notNull().default([]),
    visibility: supportMessageVisibilityEnum("visibility").$type<MessageVisibility>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("support_ticket_message_ticket_idx").on(table.ticketId)],
);

export const supportTicketAssignment = pgTable(
  "support_ticket_assignment",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTicket.id, { onDelete: "cascade" }),
    assigneeUserId: text("assignee_user_id").notNull(),
    assignedByUserId: text("assigned_by_user_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "date" }).notNull(),
    unassignedAt: timestamp("unassigned_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("support_ticket_assignment_ticket_idx").on(table.ticketId)],
);

export const supportTicketEvent = pgTable(
  "support_ticket_event",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTicket.id, { onDelete: "cascade" }),
    type: supportTicketEventTypeEnum("type").$type<TicketEventType>().notNull(),
    actorUserId: text("actor_user_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("support_ticket_event_ticket_idx").on(table.ticketId)],
);

export const statusIncident = pgTable(
  "status_incident",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    status: statusIncidentStatusEnum("status").$type<IncidentStatus>().notNull(),
    severity: statusIncidentSeverityEnum("severity").$type<IncidentSeverity>().notNull(),
    impact: text("impact").notNull(),
    provider: statusPageProviderEnum("provider").notNull().default("native"),
    externalId: text("external_id"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    updates: jsonb("updates").$type<StatusIncidentUpdate[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [unique("status_incident_slug_unique").on(table.slug)],
);

export const statusMaintenance = pgTable(
  "status_maintenance",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    status: statusMaintenanceStatusEnum("status").$type<MaintenanceStatus>().notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    provider: statusPageProviderEnum("provider").notNull().default("native"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("status_maintenance_starts_idx").on(table.startsAt)],
);

export const statusUptime = pgTable(
  "status_uptime",
  {
    id: text("id").primaryKey(),
    component: text("component").notNull(),
    day: text("day").notNull(),
    uptimeBps: integer("uptime_bps").notNull(),
  },
  (table) => [unique("status_uptime_component_day_unique").on(table.component, table.day)],
);
