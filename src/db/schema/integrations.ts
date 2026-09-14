import { index, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import type { IntegrationProviderId, IntegrationStatus } from "@/domain/integration/types";

export const integrationProviderEnum = pgEnum("integration_provider", [
  "hubspot",
  "salesforce",
  "pipedrive",
  "mailchimp",
  "klaviyo",
  "customerio",
  "notion",
  "slack",
  "discord",
  "zoom",
  "google_meet",
  "microsoft_teams",
  "youtube",
  "vimeo",
  "google_calendar",
  "outlook",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "disconnected",
  "pending",
  "connected",
  "error",
]);

export const integrationConnection = pgTable(
  "integration_connection",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").$type<IntegrationProviderId>().notNull(),
    status: integrationStatusEnum("status").$type<IntegrationStatus>().notNull(),
    ciphertext: text("ciphertext").notNull(),
    scopes: text("scopes").array().notNull().default([]),
    externalAccountId: text("external_account_id"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true, mode: "date" }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("integration_connection_org_provider_unique").on(table.organizationId, table.provider),
    index("integration_connection_org_idx").on(table.organizationId),
  ],
);

export const integrationExternalRef = pgTable(
  "integration_external_ref",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").$type<IntegrationProviderId>().notNull(),
    objectType: text("object_type").notNull(),
    localId: text("local_id").notNull(),
    externalId: text("external_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("integration_external_ref_unique").on(
      table.organizationId,
      table.provider,
      table.objectType,
      table.localId,
    ),
    index("integration_external_ref_org_idx").on(table.organizationId),
  ],
);
