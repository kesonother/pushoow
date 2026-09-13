import { describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError } from "@/domain/errors";
import { createCalendarService } from "@/domain/calendar/service";
import { createFollowService } from "@/domain/calendar/follow-service";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryCalendarMembers,
  createMemoryCalendars,
  createMemoryFollowers,
  createMemoryMembers,
  createMemorySubscriptions,
} from "@/test/fakes";

const owner: Actor = {
  userId: "org_owner",
  organizationId: "org_1",
  role: "owner",
};

async function setup(visibility: "public" | "private" = "public") {
  const calendars = createMemoryCalendars();
  const calendarService = createCalendarService({ calendars });
  const calendar = await calendarService.createCalendar(owner, { name: "Open Tech", visibility });
  const follow = createFollowService({
    calendars,
    followers: createMemoryFollowers(),
    subscriptions: createMemorySubscriptions(),
    calendarMembers: createMemoryCalendarMembers(),
    orgMembers: createMemoryMembers(),
  });
  return { follow, calendar };
}

describe("calendar follow", () => {
  it("lets a signed-in user follow and unfollow", async () => {
    const { follow, calendar } = await setup();
    const follower = await follow.follow("user_9", calendar.id, { email: true, sms: true });
    expect(follower.preferences.email).toBe(true);
    expect(await follow.countFollowers(calendar.id)).toBe(1);
    await expect(follow.follow("user_9", calendar.id)).rejects.toBeInstanceOf(ConflictError);
    await follow.unfollow("user_9", calendar.id);
    expect(await follow.countFollowers(calendar.id)).toBe(0);
  });

  it("blocks following a private calendar without membership", async () => {
    const { follow, calendar } = await setup("private");
    await expect(follow.follow("user_9", calendar.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("subscribes an email to a public calendar newsletter", async () => {
    const { follow, calendar } = await setup();
    const sub = await follow.subscribeNewsletter({
      calendarId: calendar.id,
      email: "ada@example.com",
    });
    expect(sub.status).toBe("active");
    await expect(
      follow.subscribeNewsletter({ calendarId: calendar.id, email: "ada@example.com" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
