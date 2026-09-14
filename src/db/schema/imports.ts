import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import { calendar } from "@/db/schema/calendars";
import { event } from "@/db/schema/events";
import type { ImportKind, ImportMapping, ImportReport, ImportStatus } from "@/domain/import/types";

export const importKindEnum = pgEnum("import_kind", ["guests", "subscribers", "events", "calendar"]);
export const importStatusEnum = pgEnum("import_status", [
  "uploaded",
  "mapped",
  "validated",
  "committed",
  "purged",
]);

export const importBatch = pgTable(
  "import_batch",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    kind: importKindEnum("kind").$type<ImportKind>().notNull(),
    calendarId: text("calendar_id").references(() => calendar.id, { onDelete: "set null" }),
    eventId: text("event_id").references(() => event.id, { onDelete: "set null" }),
    targetKey: text("target_key").notNull(),
    filename: text("filename").notNull(),
    contentHash: text("content_hash").notNull(),
    ciphertext: text("ciphertext").notNull(),
    byteSize: integer("byte_size").notNull(),
    status: importStatusEnum("status").$type<ImportStatus>().notNull(),
    mapping: jsonb("mapping").$type<ImportMapping>().notNull(),
    report: jsonb("report").$type<ImportReport | null>(),
    purgeAfter: timestamp("purge_after", { withTimezone: true, mode: "date" }).notNull(),
    purgedAt: timestamp("purged_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("import_batch_hash_unique").on(table.organizationId, table.kind, table.targetKey, table.contentHash),
    index("import_batch_org_idx").on(table.organizationId),
    index("import_batch_purge_idx").on(table.purgeAfter),
  ],
);
