import { index, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "admin",
  "editor",
  "check_in_manager",
  "finance",
  "read_only",
]);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("organization_slug_unique").on(table.slug),
    index("organization_deleted_at_idx").on(table.deletedAt),
  ],
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("organization_member_unique").on(table.organizationId, table.userId),
    index("organization_member_user_id_idx").on(table.userId),
  ],
);
