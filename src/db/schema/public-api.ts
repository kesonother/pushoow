import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import type { PublicApiPlan, PublicApiScope, PublicWebhookEventType } from "@/domain/public-api/types";

export const publicApiPlanEnum = pgEnum("public_api_plan", ["free", "pro", "plus", "enterprise"]);

export const publicWebhookDeliveryStatusEnum = pgEnum("public_webhook_delivery_status", [
  "pending",
  "delivered",
  "failed",
  "dead",
]);

export const publicApiKey = pgTable(
  "public_api_key",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    prefix: text("prefix").notNull(),
    scopes: text("scopes").array().$type<PublicApiScope[]>().notNull().default([]),
    plan: publicApiPlanEnum("plan").$type<PublicApiPlan>().notNull(),
    rateLimitPerMinute: integer("rate_limit_per_minute"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("public_api_key_hash_unique").on(table.keyHash),
    index("public_api_key_org_idx").on(table.organizationId),
  ],
);

export const publicOAuthClient = pgTable(
  "public_oauth_client",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    secretHash: text("secret_hash"),
    redirectUris: text("redirect_uris").array().notNull().default([]),
    scopes: text("scopes").array().$type<PublicApiScope[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("public_oauth_client_org_idx").on(table.organizationId)],
);

export const publicOAuthCode = pgTable(
  "public_oauth_code",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => publicOAuthClient.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    codeHash: text("code_hash").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("public_oauth_code_hash_unique").on(table.codeHash),
    index("public_oauth_code_client_idx").on(table.clientId),
  ],
);

export const publicWebhookEndpoint = pgTable(
  "public_webhook_endpoint",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    events: text("events").array().$type<PublicWebhookEventType[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("public_webhook_endpoint_org_idx").on(table.organizationId)],
);

export const publicWebhookDelivery = pgTable(
  "public_webhook_delivery",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => publicWebhookEndpoint.id, { onDelete: "cascade" }),
    event: text("event").$type<PublicWebhookEventType>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: publicWebhookDeliveryStatusEnum("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    responseStatus: integer("response_status"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("public_webhook_delivery_endpoint_idx").on(table.endpointId),
    index("public_webhook_delivery_org_idx").on(table.organizationId),
  ],
);
