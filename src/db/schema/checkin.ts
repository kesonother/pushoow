import { index, integer, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import { event } from "@/db/schema/events";
import { eventRegistration } from "@/db/schema/event-commerce";
import { issuedTicket } from "@/db/schema/payments";

export const checkInSourceEnum = pgEnum("check_in_source", ["scan", "search", "bulk", "walk_in", "sync"]);

export const checkInPass = pgTable(
  "check_in_pass",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    registrationId: text("registration_id")
      .notNull()
      .references(() => eventRegistration.id, { onDelete: "cascade" }),
    issuedTicketId: text("issued_ticket_id").references(() => issuedTicket.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("check_in_pass_registration_unique").on(table.registrationId),
    index("check_in_pass_event_idx").on(table.eventId),
  ],
);

export const checkInRecord = pgTable(
  "check_in_record",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    registrationId: text("registration_id")
      .notNull()
      .references(() => eventRegistration.id, { onDelete: "cascade" }),
    issuedTicketId: text("issued_ticket_id").references(() => issuedTicket.id, { onDelete: "set null" }),
    actorUserId: text("actor_user_id"),
    source: checkInSourceEnum("source").notNull(),
    deviceId: text("device_id"),
    clientOpId: text("client_op_id").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("check_in_record_registration_unique").on(table.eventId, table.registrationId),
    unique("check_in_record_client_op_unique").on(table.clientOpId),
    index("check_in_record_event_idx").on(table.eventId),
  ],
);

export const checkInCapacityAlert = pgTable(
  "check_in_capacity_alert",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    threshold: integer("threshold").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [unique("check_in_capacity_alert_unique").on(table.eventId, table.threshold)],
);
