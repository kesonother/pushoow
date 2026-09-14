import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  calendarFollower,
  calendarMember,
  calendarMembershipTier,
  calendarSubscriber,
} from "@/db/schema";
import type {
  CalendarFollower,
  CalendarFollowerRepository,
  CalendarSubscription,
  CalendarSubscriptionRepository,
} from "@/domain/calendar/follow-types";
import type {
  CalendarMember,
  CalendarMemberRepository,
  CalendarMembershipTier,
  CalendarMembershipTierRepository,
  MembershipStatus,
  TierKind,
} from "@/domain/calendar/membership-types";

function mapFollower(row: typeof calendarFollower.$inferSelect): CalendarFollower {
  return {
    id: row.id,
    organizationId: row.organizationId,
    calendarId: row.calendarId,
    userId: row.userId,
    preferences: {
      email: row.notifyEmail,
      push: row.notifyPush,
      sms: row.notifySms,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSubscription(row: typeof calendarSubscriber.$inferSelect): CalendarSubscription {
  return {
    id: row.id,
    organizationId: row.organizationId,
    calendarId: row.calendarId,
    userId: row.userId,
    email: row.email,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapTier(row: typeof calendarMembershipTier.$inferSelect): CalendarMembershipTier {
  return {
    id: row.id,
    organizationId: row.organizationId,
    calendarId: row.calendarId,
    name: row.name,
    kind: row.kind as TierKind,
    visibility: row.visibility,
    memberOnlyTickets: row.memberOnlyTickets,
    newsletters: row.newsletters,
    earlyRsvp: row.earlyRsvp,
    requiresApproval: row.requiresApproval,
    priceCents: row.priceCents,
    currency: row.currency,
    interval: row.interval === "month" || row.interval === "year" ? row.interval : null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMember(row: typeof calendarMember.$inferSelect): CalendarMember {
  return {
    id: row.id,
    organizationId: row.organizationId,
    calendarId: row.calendarId,
    userId: row.userId,
    tierId: row.tierId,
    status: row.status as MembershipStatus,
    paymentExternalId: row.paymentExternalId,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleCalendarFollowerRepository(
  db: Database,
): CalendarFollowerRepository {
  return {
    async create(follower) {
      const [row] = await db
        .insert(calendarFollower)
        .values({
          id: follower.id,
          organizationId: follower.organizationId,
          calendarId: follower.calendarId,
          userId: follower.userId,
          notifyEmail: follower.preferences.email,
          notifyPush: follower.preferences.push,
          notifySms: follower.preferences.sms,
          createdAt: follower.createdAt,
          updatedAt: follower.updatedAt,
        })
        .returning();
      return mapFollower(row);
    },
    async findByUserAndCalendar(userId, calendarId) {
      const [row] = await db
        .select()
        .from(calendarFollower)
        .where(
          and(eq(calendarFollower.userId, userId), eq(calendarFollower.calendarId, calendarId)),
        )
        .limit(1);
      return row ? mapFollower(row) : null;
    },
    async listByCalendar(calendarId) {
      const rows = await db
        .select()
        .from(calendarFollower)
        .where(eq(calendarFollower.calendarId, calendarId));
      return rows.map(mapFollower);
    },
    async listByUser(userId) {
      const rows = await db.select().from(calendarFollower).where(eq(calendarFollower.userId, userId));
      return rows.map(mapFollower);
    },
    async countByCalendar(calendarId) {
      const rows = await db
        .select()
        .from(calendarFollower)
        .where(eq(calendarFollower.calendarId, calendarId));
      return rows.length;
    },
    async save(follower) {
      const [row] = await db
        .update(calendarFollower)
        .set({
          notifyEmail: follower.preferences.email,
          notifyPush: follower.preferences.push,
          notifySms: follower.preferences.sms,
          updatedAt: follower.updatedAt,
        })
        .where(eq(calendarFollower.id, follower.id))
        .returning();
      return mapFollower(row);
    },
    async delete(id) {
      await db.delete(calendarFollower).where(eq(calendarFollower.id, id));
    },
  };
}

export function createDrizzleCalendarSubscriptionRepository(
  db: Database,
): CalendarSubscriptionRepository {
  return {
    async create(subscription) {
      const [row] = await db.insert(calendarSubscriber).values(subscription).returning();
      return mapSubscription(row);
    },
    async findByEmailAndCalendar(email, calendarId) {
      const [row] = await db
        .select()
        .from(calendarSubscriber)
        .where(
          and(eq(calendarSubscriber.email, email), eq(calendarSubscriber.calendarId, calendarId)),
        )
        .limit(1);
      return row ? mapSubscription(row) : null;
    },
    async listByCalendar(calendarId) {
      const rows = await db
        .select()
        .from(calendarSubscriber)
        .where(eq(calendarSubscriber.calendarId, calendarId));
      return rows.map(mapSubscription);
    },
    async save(subscription) {
      const [row] = await db
        .update(calendarSubscriber)
        .set({
          status: subscription.status,
          userId: subscription.userId,
          updatedAt: subscription.updatedAt,
        })
        .where(eq(calendarSubscriber.id, subscription.id))
        .returning();
      return mapSubscription(row);
    },
  };
}

export function createDrizzleCalendarTierRepository(
  db: Database,
): CalendarMembershipTierRepository {
  return {
    async create(tier) {
      const [row] = await db.insert(calendarMembershipTier).values(tier).returning();
      return mapTier(row);
    },
    async findById(id) {
      const [row] = await db
        .select()
        .from(calendarMembershipTier)
        .where(eq(calendarMembershipTier.id, id))
        .limit(1);
      return row ? mapTier(row) : null;
    },
    async listByCalendar(calendarId) {
      const rows = await db
        .select()
        .from(calendarMembershipTier)
        .where(eq(calendarMembershipTier.calendarId, calendarId));
      return rows.map(mapTier);
    },
    async save(tier) {
      const [row] = await db
        .update(calendarMembershipTier)
        .set({
          name: tier.name,
          kind: tier.kind,
          visibility: tier.visibility,
          memberOnlyTickets: tier.memberOnlyTickets,
          newsletters: tier.newsletters,
          earlyRsvp: tier.earlyRsvp,
          requiresApproval: tier.requiresApproval,
          priceCents: tier.priceCents,
          currency: tier.currency,
          interval: tier.interval,
          sortOrder: tier.sortOrder,
          updatedAt: tier.updatedAt,
        })
        .where(eq(calendarMembershipTier.id, tier.id))
        .returning();
      return mapTier(row);
    },
    async delete(id) {
      await db.delete(calendarMembershipTier).where(eq(calendarMembershipTier.id, id));
    },
  };
}

export function createDrizzleCalendarMemberRepository(db: Database): CalendarMemberRepository {
  return {
    async create(member) {
      const [row] = await db.insert(calendarMember).values(member).returning();
      return mapMember(row);
    },
    async findById(id) {
      const [row] = await db.select().from(calendarMember).where(eq(calendarMember.id, id)).limit(1);
      return row ? mapMember(row) : null;
    },
    async findByUserAndCalendar(userId, calendarId) {
      const [row] = await db
        .select()
        .from(calendarMember)
        .where(and(eq(calendarMember.userId, userId), eq(calendarMember.calendarId, calendarId)))
        .limit(1);
      return row ? mapMember(row) : null;
    },
    async listByCalendar(calendarId) {
      const rows = await db
        .select()
        .from(calendarMember)
        .where(eq(calendarMember.calendarId, calendarId));
      return rows.map(mapMember);
    },
    async save(member) {
      const [row] = await db
        .update(calendarMember)
        .set({
          tierId: member.tierId,
          status: member.status,
          paymentExternalId: member.paymentExternalId,
          decidedAt: member.decidedAt,
          updatedAt: member.updatedAt,
        })
        .where(eq(calendarMember.id, member.id))
        .returning();
      return mapMember(row);
    },
  };
}
