import { boolean, index, integer, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "@/db/schema/organizations";
import { user } from "@/db/schema/auth";
import type { AIGenerationKind } from "@/domain/ai/types";

export const aiGenerationKindEnum = pgEnum("ai_generation_kind", [
  "description",
  "cover",
  "search",
  "suggestions",
  "recap",
]);

export const aiGeneration = pgTable(
  "ai_generation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    kind: aiGenerationKindEnum("kind").$type<AIGenerationKind>().notNull(),
    providerId: text("provider_id").notNull(),
    model: text("model").notNull(),
    inputHash: text("input_hash").notNull(),
    outputSummary: text("output_summary").notNull(),
    aiGenerated: boolean("ai_generated").notNull().default(true),
    trainingAllowed: boolean("training_allowed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("ai_generation_org_idx").on(table.organizationId),
    index("ai_generation_actor_idx").on(table.actorUserId),
  ],
);

export const aiConsent = pgTable("ai_consent", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  processingOptOut: boolean("processing_opt_out").notNull().default(false),
  trainingConsent: boolean("training_consent").notNull().default(false),
  disclosureAcknowledged: boolean("disclosure_acknowledged").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const aiOrgPolicy = pgTable(
  "ai_org_policy",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    optedOut: boolean("opted_out").notNull().default(false),
    trainingAllowed: boolean("training_allowed").notNull().default(false),
    providerRetentionDays: integer("provider_retention_days").notNull().default(0),
    disclosureVersion: text("disclosure_version").notNull().default("1"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [unique("ai_org_policy_org_unique").on(table.organizationId)],
);
