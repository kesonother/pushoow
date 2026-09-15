import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import type {
  CalendarFollower,
  CalendarFollowerRepository,
  CalendarSubscription,
  CalendarSubscriptionRepository,
  NotificationPreferences,
} from "@/domain/calendar/follow-types";
import type { CalendarRepository } from "@/domain/calendar/types";
import type { CalendarMemberRepository } from "@/domain/calendar/membership-types";
import type { MembershipRepository } from "@/domain/organization/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { canViewPrivateCalendar } from "@/domain/calendar/access";

export type FollowServiceDeps = {
  calendars: CalendarRepository;
  followers: CalendarFollowerRepository;
  subscriptions: CalendarSubscriptionRepository;
  calendarMembers: CalendarMemberRepository;
  orgMembers: MembershipRepository;
  clock?: Clock;
  ids?: IdGenerator;
  onFollowed?: (follower: CalendarFollower) => Promise<void>;
};

const defaultPreferences = (): NotificationPreferences => ({
  email: true,
  push: false,
  sms: false,
});

export function createFollowService(deps: FollowServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function requireVisibleCalendar(userId: string, calendarId: string) {
    const calendar = await deps.calendars.findById(calendarId);
    if (!calendar || calendar.deletedAt) {
      throw new NotFoundError("Calendar", calendarId);
    }
    if (calendar.visibility === "private") {
      const allowed = await canViewPrivateCalendar(
        { orgMembers: deps.orgMembers, calendarMembers: deps.calendarMembers },
        userId,
        calendar,
      );
      if (!allowed) {
        throw new ForbiddenError("Join this calendar before following it");
      }
    }
    return calendar;
  }

  async function follow(
    userId: string,
    calendarId: string,
    preferences?: Partial<NotificationPreferences>,
  ): Promise<CalendarFollower> {
    const calendar = await requireVisibleCalendar(userId, calendarId);
    const existing = await deps.followers.findByUserAndCalendar(userId, calendarId);
    if (existing) {
      throw new ConflictError("You already follow this calendar");
    }

    const now = clock.now();
    const follower = await deps.followers.create({
      id: ids.id(),
      organizationId: calendar.organizationId,
      calendarId: calendar.id,
      userId,
      preferences: { ...defaultPreferences(), ...preferences },
      createdAt: now,
      updatedAt: now,
    });
    await deps.onFollowed?.(follower);
    return follower;
  }

  async function unfollow(userId: string, calendarId: string): Promise<void> {
    const existing = await deps.followers.findByUserAndCalendar(userId, calendarId);
    if (!existing) {
      throw new NotFoundError("CalendarFollower");
    }
    await deps.followers.delete(existing.id);
  }

  async function updatePreferences(
    userId: string,
    calendarId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<CalendarFollower> {
    const existing = await deps.followers.findByUserAndCalendar(userId, calendarId);
    if (!existing) {
      throw new NotFoundError("CalendarFollower");
    }
    return deps.followers.save({
      ...existing,
      preferences: { ...existing.preferences, ...preferences },
      updatedAt: clock.now(),
    });
  }

  async function getFollow(
    userId: string,
    calendarId: string,
  ): Promise<CalendarFollower | null> {
    return deps.followers.findByUserAndCalendar(userId, calendarId);
  }

  async function countFollowers(calendarId: string): Promise<number> {
    return deps.followers.countByCalendar(calendarId);
  }

  async function subscribeNewsletter(input: {
    calendarId: string;
    email: string;
    userId?: string | null;
  }): Promise<CalendarSubscription> {
    const calendar = await deps.calendars.findById(input.calendarId);
    if (!calendar || calendar.deletedAt) {
      throw new NotFoundError("Calendar", input.calendarId);
    }
    if (calendar.visibility === "private") {
      throw new ForbiddenError("This calendar is member-only");
    }

    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError("A valid email is required");
    }

    const existing = await deps.subscriptions.findByEmailAndCalendar(email, calendar.id);
    const now = clock.now();
    if (existing) {
      if (existing.status === "active") {
        throw new ConflictError("This email is already subscribed");
      }
      return deps.subscriptions.save({
        ...existing,
        status: "active",
        userId: input.userId ?? existing.userId,
        updatedAt: now,
      });
    }

    return deps.subscriptions.create({
      id: ids.id(),
      organizationId: calendar.organizationId,
      calendarId: calendar.id,
      userId: input.userId ?? null,
      email,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    follow,
    unfollow,
    updatePreferences,
    getFollow,
    countFollowers,
    subscribeNewsletter,
  };
}
