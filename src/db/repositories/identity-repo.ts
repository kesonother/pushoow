import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  accountModeration,
  attendeeProfile,
  organizationDomain,
  organizationInvitation,
  organizerProfile,
  refreshToken,
} from "@/db/schema";
import { user } from "@/db/schema/auth";
import type { DomainRepository, OrganizationDomain } from "@/domain/enterprise/domains";
import type { ModerationAction, ModerationRepository } from "@/domain/moderation/types";
import type {
  InvitationRepository,
  OrganizationInvitation,
  UserDirectory,
} from "@/domain/organization/types";
import type {
  AttendeeProfile,
  OrganizerProfile,
  ProfileRepository,
} from "@/domain/profile/types";
import type { OrganizationRole } from "@/domain/rbac/roles";
import type { RefreshTokenRecord, RefreshTokenRepository } from "@/domain/session/types";

export function createDrizzleUserDirectory(db: Database): UserDirectory {
  return {
    async findById(id) {
      const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1);
      return row
        ? { id: row.id, email: row.email, emailVerified: row.emailVerified }
        : null;
    },
    async findByEmail(email) {
      const [row] = await db
        .select()
        .from(user)
        .where(eq(user.email, email.toLowerCase()))
        .limit(1);
      return row
        ? { id: row.id, email: row.email, emailVerified: row.emailVerified }
        : null;
    },
  };
}

export function createDrizzleProfileRepository(db: Database): ProfileRepository {
  return {
    async getOrganizer(userId) {
      const [row] = await db
        .select()
        .from(organizerProfile)
        .where(eq(organizerProfile.userId, userId))
        .limit(1);
      return row ?? null;
    },
    async getAttendee(userId) {
      const [row] = await db
        .select()
        .from(attendeeProfile)
        .where(eq(attendeeProfile.userId, userId))
        .limit(1);
      return row
        ? {
            ...row,
            appearOnRoster: row.appearOnRoster ?? false,
            showAvatar: row.showAvatar ?? false,
            showBio: row.showBio ?? false,
            showSocial: row.showSocial ?? false,
          }
        : null;
    },
    async upsertOrganizer(profile: OrganizerProfile) {
      const [row] = await db
        .insert(organizerProfile)
        .values(profile)
        .onConflictDoUpdate({
          target: organizerProfile.userId,
          set: {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            bio: profile.bio,
            website: profile.website,
            linkedin: profile.linkedin,
            updatedAt: profile.updatedAt,
          },
        })
        .returning();
      return row;
    },
    async upsertAttendee(profile: AttendeeProfile) {
      const [row] = await db
        .insert(attendeeProfile)
        .values(profile)
        .onConflictDoUpdate({
          target: attendeeProfile.userId,
          set: {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            bio: profile.bio,
            website: profile.website,
            linkedin: profile.linkedin,
            visibility: profile.visibility,
            appearOnRoster: profile.appearOnRoster,
            showAvatar: profile.showAvatar,
            showBio: profile.showBio,
            showSocial: profile.showSocial,
            updatedAt: profile.updatedAt,
          },
        })
        .returning();
      return row;
    },
  };
}

function mapRefresh(row: typeof refreshToken.$inferSelect): RefreshTokenRecord {
  return row;
}

export function createDrizzleRefreshTokenRepository(db: Database): RefreshTokenRepository {
  return {
    async create(token) {
      const [row] = await db.insert(refreshToken).values(token).returning();
      return mapRefresh(row);
    },
    async findByHash(tokenHash) {
      const [row] = await db
        .select()
        .from(refreshToken)
        .where(eq(refreshToken.tokenHash, tokenHash))
        .limit(1);
      return row ? mapRefresh(row) : null;
    },
    async listByFamily(familyId) {
      const rows = await db
        .select()
        .from(refreshToken)
        .where(eq(refreshToken.familyId, familyId));
      return rows.map(mapRefresh);
    },
    async listByUser(userId) {
      const rows = await db.select().from(refreshToken).where(eq(refreshToken.userId, userId));
      return rows.map(mapRefresh);
    },
    async save(token) {
      const [row] = await db
        .update(refreshToken)
        .set({
          consumedAt: token.consumedAt,
          revokedAt: token.revokedAt,
          replacedByTokenId: token.replacedByTokenId,
          updatedAt: token.updatedAt,
        })
        .where(eq(refreshToken.id, token.id))
        .returning();
      return mapRefresh(row);
    },
    async revokeFamily(familyId, at) {
      await db
        .update(refreshToken)
        .set({ revokedAt: at, updatedAt: at })
        .where(eq(refreshToken.familyId, familyId));
    },
    async revokeAllForUser(userId, at) {
      await db
        .update(refreshToken)
        .set({ revokedAt: at, updatedAt: at })
        .where(eq(refreshToken.userId, userId));
    },
  };
}

function mapInvitation(row: typeof organizationInvitation.$inferSelect): OrganizationInvitation {
  return {
    ...row,
    role: row.role as OrganizationRole,
  };
}

export function createDrizzleInvitationRepository(db: Database): InvitationRepository {
  return {
    async create(invitation) {
      const [row] = await db.insert(organizationInvitation).values(invitation).returning();
      return mapInvitation(row);
    },
    async findById(id) {
      const [row] = await db
        .select()
        .from(organizationInvitation)
        .where(eq(organizationInvitation.id, id))
        .limit(1);
      return row ? mapInvitation(row) : null;
    },
    async findByTokenHash(tokenHash) {
      const [row] = await db
        .select()
        .from(organizationInvitation)
        .where(eq(organizationInvitation.tokenHash, tokenHash))
        .limit(1);
      return row ? mapInvitation(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(organizationInvitation)
        .where(eq(organizationInvitation.organizationId, organizationId));
      return rows.map(mapInvitation);
    },
    async save(invitation) {
      const [row] = await db
        .update(organizationInvitation)
        .set({
          status: invitation.status,
          acceptedAt: invitation.acceptedAt,
          acceptedByUserId: invitation.acceptedByUserId,
          revokedAt: invitation.revokedAt,
          updatedAt: invitation.updatedAt,
        })
        .where(eq(organizationInvitation.id, invitation.id))
        .returning();
      return mapInvitation(row);
    },
  };
}

function mapDomain(row: typeof organizationDomain.$inferSelect): OrganizationDomain {
  return {
    id: row.id,
    organizationId: row.organizationId,
    domain: row.domain,
    kind: row.kind === "site" ? "site" : "email",
    tokenHash: row.tokenHash,
    verifiedAt: row.verifiedAt,
    autoJoin: row.autoJoin,
    autoJoinRole: row.autoJoinRole as OrganizationRole,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleDomainRepository(db: Database): DomainRepository {
  return {
    async create(domain) {
      const [row] = await db.insert(organizationDomain).values(domain).returning();
      return mapDomain(row);
    },
    async findByDomain(domain) {
      const [row] = await db
        .select()
        .from(organizationDomain)
        .where(eq(organizationDomain.domain, domain))
        .limit(1);
      return row ? mapDomain(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(organizationDomain)
        .where(eq(organizationDomain.organizationId, organizationId));
      return rows.map(mapDomain);
    },
    async save(domain) {
      const [row] = await db
        .update(organizationDomain)
        .set({
          verifiedAt: domain.verifiedAt,
          autoJoin: domain.autoJoin,
          autoJoinRole: domain.autoJoinRole,
          updatedAt: domain.updatedAt,
        })
        .where(eq(organizationDomain.id, domain.id))
        .returning();
      return mapDomain(row);
    },
  };
}

export function createDrizzleModerationRepository(db: Database): ModerationRepository {
  return {
    async create(action) {
      const [row] = await db.insert(accountModeration).values(action).returning();
      return row as ModerationAction;
    },
    async listByUser(userId) {
      const rows = await db
        .select()
        .from(accountModeration)
        .where(eq(accountModeration.userId, userId));
      return rows as ModerationAction[];
    },
    async findById(id) {
      const [row] = await db
        .select()
        .from(accountModeration)
        .where(eq(accountModeration.id, id))
        .limit(1);
      return (row as ModerationAction | undefined) ?? null;
    },
    async save(action) {
      const [row] = await db
        .update(accountModeration)
        .set(action)
        .where(eq(accountModeration.id, action.id))
        .returning();
      return row as ModerationAction;
    },
  };
}

export function createSharedOrganizationLookup(db: Database) {
  return {
    async shareOrganization(viewerId: string, targetId: string) {
      const { organizationMember } = await import("@/db/schema/organizations");
      const viewer = await db
        .select()
        .from(organizationMember)
        .where(eq(organizationMember.userId, viewerId));
      if (viewer.length === 0) return false;
      const orgIds = new Set(viewer.map((item) => item.organizationId));
      const target = await db
        .select()
        .from(organizationMember)
        .where(eq(organizationMember.userId, targetId));
      return target.some((item) => orgIds.has(item.organizationId));
    },
  };
}

export async function revokeBetterAuthSessions(db: Database, userId: string) {
  const { session } = await import("@/db/schema/auth");
  await db.delete(session).where(eq(session.userId, userId));
}

