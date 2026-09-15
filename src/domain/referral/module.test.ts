import { afterEach, describe, expect, it } from "vitest";
import { resetMetrics } from "@/observability/metrics";
import { createMemoryReferralCodes, createMemoryReferralConversions } from "./memory";
import { createReferralService } from "./service";
import { normalizeReferralCode } from "./codes";

afterEach(() => {
  resetMetrics();
});

describe("referral codes", () => {
  it("normalizes and rejects invalid codes", () => {
    expect(normalizeReferralCode(" abcd2345 ")).toBe("ABCD2345");
    expect(normalizeReferralCode("nope")).toBeNull();
  });
});

describe("organizer and attendee referral", () => {
  it("issues links, attributes, grants rewards, and blocks fraud", async () => {
    const referrals = createReferralService({
      codes: createMemoryReferralCodes(),
      conversions: createMemoryReferralConversions(),
      origin: "https://pushoow.test",
    });

    const organizer = await referrals.forOrganizer("user_host", "org_host");
    expect(organizer.link).toContain("/register?ref=");
    expect(organizer.code.kind).toBe("organizer");

    await referrals.recordClick(organizer.code.code);
    const signup = await referrals.attributeSignup({
      code: organizer.code.code,
      userId: "user_new",
      email: "new@example.com",
    });
    expect(signup?.status).toBe("attributed");
    expect(signup?.rewardStatus).toBe("none");

    const rewarded = await referrals.attributeOrganizer({
      code: organizer.code.code,
      userId: "user_new",
      organizationId: "org_new",
    });
    expect(rewarded?.status).toBe("granted");
    expect(rewarded?.rewardStatus).toBe("granted");

    const self = await referrals.attributeOrganizer({
      code: organizer.code.code,
      userId: "user_host",
      organizationId: "org_host",
    });
    expect(self?.status).toBe("blocked");
    expect(self?.reason).toBe("self");

    const attendee = await referrals.forAttendee("user_guest", "evt_1");
    expect(attendee.link).toContain(`/r/${attendee.code.code}`);
    const rsvp = await referrals.attributeAttendeeRsvp({
      code: attendee.code.code,
      userId: "user_friend",
      email: "friend@example.com",
      eventId: "evt_1",
      visitorHash: "vid_1",
    });
    expect(rsvp?.status).toBe("granted");

    const mismatch = await referrals.attributeAttendeeRsvp({
      code: attendee.code.code,
      userId: "user_other",
      eventId: "evt_other",
    });
    expect(mismatch?.status).toBe("rejected");
    expect(mismatch?.reason).toBe("event_mismatch");

    const replay = await referrals.attributeAttendeeRsvp({
      code: attendee.code.code,
      userId: "user_third",
      eventId: "evt_1",
      visitorHash: "vid_1",
    });
    expect(replay?.status).toBe("blocked");
  });
});
