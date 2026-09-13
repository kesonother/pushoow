import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";
import { organization, organizationRoleEnum } from "@/db/schema/organizations";

export const attendeeVisibilityEnum = pgEnum("attendee_visibility", [
  "private",
  "organization",
  "public",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
]);

export const ssoProtocolEnum = pgEnum("sso_protocol", ["saml", "oidc"]);

export const moderationTypeEnum = pgEnum("moderation_type", [
  "warning",
  "temporary_suspension",
  "permanent_ban",
]);

export const moderationReasonCategoryEnum = pgEnum("moderation_reason_category", [
  "policy",
  "abuse",
  "fraud",
  "illegal",
  "other",
]);

export const appealStatusEnum = pgEnum("appeal_status", [
  "none",
  "submitted",
  "accepted",
  "rejected",
]);

export const organizerProfile = pgTable("organizer_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  website: text("website"),
  linkedin: text("linkedin"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const attendeeProfile = pgTable("attendee_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  website: text("website"),
  linkedin: text("linkedin"),
  visibility: attendeeVisibilityEnum("visibility").notNull().default("private"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const refreshToken = pgTable(
  "refresh_token",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    familyId: text("family_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    replacedByTokenId: text("replaced_by_token_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("refresh_token_hash_unique").on(table.tokenHash),
    index("refresh_token_user_id_idx").on(table.userId),
    index("refresh_token_family_id_idx").on(table.familyId),
  ],
);

export const organizationInvitation = pgTable(
  "organization_invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: organizationRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: invitationStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("organization_invitation_token_hash_unique").on(table.tokenHash),
    index("organization_invitation_org_id_idx").on(table.organizationId),
    index("organization_invitation_email_idx").on(table.email),
  ],
);

export const organizationDomain = pgTable(
  "organization_domain",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    tokenHash: text("token_hash").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    autoJoin: boolean("auto_join").notNull().default(false),
    autoJoinRole: organizationRoleEnum("auto_join_role").notNull().default("read_only"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("organization_domain_unique").on(table.domain),
    index("organization_domain_org_id_idx").on(table.organizationId),
  ],
);

export const organizationSsoConnection = pgTable(
  "organization_sso_connection",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    protocol: ssoProtocolEnum("protocol").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("organization_sso_org_id_idx").on(table.organizationId)],
);

export const accountModeration = pgTable(
  "account_moderation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: moderationTypeEnum("type").notNull(),
    reason: text("reason").notNull(),
    reasonCategory: moderationReasonCategoryEnum("reason_category").notNull(),
    immediate: boolean("immediate").notNull(),
    noticeAt: timestamp("notice_at", { withTimezone: true, mode: "date" }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    notifiedAt: timestamp("notified_at", { withTimezone: true, mode: "date" }),
    appealStatus: appealStatusEnum("appeal_status").notNull().default("none"),
    appealReason: text("appeal_reason"),
    appealedAt: timestamp("appealed_at", { withTimezone: true, mode: "date" }),
    appealResolvedAt: timestamp("appeal_resolved_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("account_moderation_user_id_idx").on(table.userId),
    index("account_moderation_starts_at_idx").on(table.startsAt),
  ],
);
