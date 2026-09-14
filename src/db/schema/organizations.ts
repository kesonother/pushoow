import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import type { BillingMode, FunctionalLevel, OrganizationKind } from "@/domain/organization/types";
import type { CustomGrant } from "@/domain/rbac/grants";

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "admin",
  "editor",
  "check_in_manager",
  "finance",
  "read_only",
  "custom",
]);

export const organizationKindEnum = pgEnum("organization_kind", ["standard", "agency", "client"]);
export const functionalLevelEnum = pgEnum("functional_level", ["free", "pro", "plus", "enterprise"]);
export const billingModeEnum = pgEnum("billing_mode", ["own", "consolidated"]);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: organizationKindEnum("kind").$type<OrganizationKind>().notNull().default("standard"),
    agencyOrganizationId: text("agency_organization_id"),
    functionalLevel: functionalLevelEnum("functional_level").$type<FunctionalLevel>().notNull().default("free"),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
    billingMode: billingModeEnum("billing_mode").$type<BillingMode>().notNull().default("own"),
    billingOrganizationId: text("billing_organization_id"),
    auditRetentionDays: integer("audit_retention_days").notNull().default(365),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("organization_slug_unique").on(table.slug),
    index("organization_deleted_at_idx").on(table.deletedAt),
    index("organization_agency_idx").on(table.agencyOrganizationId),
  ],
);

export const organizationCustomRole = pgTable(
  "organization_custom_role",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    grants: text("grants").array().$type<CustomGrant[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("organization_custom_role_org_idx").on(table.organizationId)],
);

export const organizationMember = pgTable(
  "organization_member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").notNull(),
    customRoleId: text("custom_role_id").references(() => organizationCustomRole.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("organization_member_unique").on(table.organizationId, table.userId),
    index("organization_member_user_id_idx").on(table.userId),
  ],
);

export const agencyClient = pgTable(
  "agency_client",
  {
    id: text("id").primaryKey(),
    agencyOrganizationId: text("agency_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientOrganizationId: text("client_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("agency_client_unique").on(table.agencyOrganizationId, table.clientOrganizationId),
    unique("agency_client_client_unique").on(table.clientOrganizationId),
    index("agency_client_agency_idx").on(table.agencyOrganizationId),
  ],
);
