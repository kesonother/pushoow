import { index, integer, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import { calendar } from "@/db/schema/calendars";
import { event } from "@/db/schema/events";

export const chatAuthorKindEnum = pgEnum("chat_author_kind", ["user", "organizer"]);
export const chatReportStatusEnum = pgEnum("chat_report_status", [
  "open",
  "reviewed",
  "dismissed",
]);
export const chatModerationTypeEnum = pgEnum("chat_moderation_type", [
  "soft_delete",
  "hard_delete",
  "ban",
  "unban",
]);

export const eventChat = pgTable(
  "event_chat",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    nextSeq: integer("next_seq").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("event_chat_event_id_unique").on(table.eventId),
    index("event_chat_organization_id_idx").on(table.organizationId),
  ],
);

export const eventChatThread = pgTable(
  "event_chat_thread",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => eventChat.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("event_chat_thread_event_id_idx").on(table.eventId)],
);

export const eventChatMessage = pgTable(
  "event_chat_message",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => eventChat.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .notNull()
      .references(() => eventChatThread.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    authorUserId: text("author_user_id"),
    authorKind: chatAuthorKindEnum("author_kind").notNull().default("user"),
    body: text("body").notNull(),
    clientId: text("client_id"),
    seq: integer("seq").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    hardDeletedAt: timestamp("hard_deleted_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("event_chat_message_client_id_unique").on(table.chatId, table.clientId),
    index("event_chat_message_event_seq_idx").on(table.eventId, table.seq),
    index("event_chat_message_thread_id_idx").on(table.threadId),
  ],
);

export const eventChatReport = pgTable(
  "event_chat_report",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => eventChatMessage.id, { onDelete: "cascade" }),
    reporterUserId: text("reporter_user_id").notNull(),
    reason: text("reason").notNull(),
    status: chatReportStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("event_chat_report_unique").on(table.messageId, table.reporterUserId),
    index("event_chat_report_event_id_idx").on(table.eventId),
  ],
);

export const eventChatModeration = pgTable(
  "event_chat_moderation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => eventChat.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    type: chatModerationTypeEnum("type").notNull(),
    targetUserId: text("target_user_id"),
    targetMessageId: text("target_message_id"),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("event_chat_moderation_event_id_idx").on(table.eventId)],
);
