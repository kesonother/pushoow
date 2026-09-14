import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import { organization } from "@/db/schema/organizations";

export const consentPurposeEnum = pgEnum("consent_purpose", [
  "necessary",
  "marketing",
  "tracking",
  "data_sale",
]);

export const deletionStatusEnum = pgEnum("deletion_status", [
  "pending",
  "processing",
  "completed",
  "rejected",
]);

export const privacyConsent = pgTable(
  "privacy_consent",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    purpose: consentPurposeEnum("purpose").notNull(),
    granted: boolean("granted").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("privacy_consent_user_id_idx").on(table.userId)],
);

export const privacyDeletionRequest = pgTable(
  "privacy_deletion_request",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: deletionStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("privacy_deletion_user_status_idx").on(table.userId, table.status)],
);

export const privacyProcessingRecord = pgTable(
  "privacy_processing_record",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    purpose: text("purpose").notNull(),
    legalBasis: text("legal_basis").notNull(),
    categories: jsonb("categories").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("privacy_processing_user_id_idx").on(table.userId)],
);

export const privacyCcpaSettings = pgTable("privacy_ccpa_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  saleOptOut: boolean("sale_opt_out").notNull().default(true),
  disclosureAcknowledged: boolean("disclosure_acknowledged").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const privacyAudit = pgTable(
  "privacy_audit",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    organizationId: text("organization_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("privacy_audit_actor_idx").on(table.actorUserId)],
);
