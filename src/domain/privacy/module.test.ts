import { describe, expect, it } from "vitest";
import { ForbiddenError, RateLimitedError, ValidationError } from "@/domain/errors";
import type { EventRegistration } from "@/domain/event/commerce-types";
import type { Event } from "@/domain/event/types";
import { eventDefaults } from "@/domain/event/types";
import { assessPaymentRisk } from "@/domain/privacy/risk";
import { createMemoryCaptchaVerifier } from "@/domain/privacy/captcha";
import {
  memoryCcpa,
  memoryConsents,
  memoryDeletions,
  memoryPrivacyAudit,
  memoryProcessing,
} from "@/domain/privacy/memory";
import { assertCanMutateRosterMode, buildRoster } from "@/domain/privacy/roster";
import { createPrivacyService } from "@/domain/privacy/service";
import { incrementVelocity, resetVelocity } from "@/domain/privacy/velocity";
import type { AttendeeProfile } from "@/domain/profile/types";
import { createMemoryEvents } from "@/test/fakes";

const now = new Date("2026-09-13T12:00:00.000Z");

function event(overrides?: Partial<Event>): Event {
  return {
    id: "evt_1",
    organizationId: "org_a",
    calendarId: "cal_1",
    slug: "privacy-meetup",
    title: "Privacy Meetup",
    description: null,
    startsAt: new Date("2026-10-01T16:00:00.000Z"),
    endsAt: new Date("2026-10-01T18:00:00.000Z"),
    timezone: "Europe/Paris",
    status: "published",
    visibility: "public",
    isPaid: false,
    isFeatured: false,
    tags: [],
    venueName: null,
    venueAddress: null,
    ...eventDefaults(),
    rosterMode: "hidden",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function registration(overrides?: Partial<EventRegistration>): EventRegistration {
  return {
    id: "reg_1",
    organizationId: "org_a",
    calendarId: "cal_1",
    eventId: "evt_1",
    userId: "user_ada",
    email: "ada@example.com",
    status: "confirmed",
    occurrenceStartsAt: null,
    orderId: null,
    ticketTypeId: null,
    quantity: 1,
    offeredUntil: null,
    waitlistPosition: null,
    anonymous: false,
    appearOnRoster: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function profile(overrides?: Partial<AttendeeProfile>): AttendeeProfile {
  return {
    userId: "user_ada",
    displayName: "Ada",
    avatarUrl: "https://cdn.example/ada.png",
    bio: "Builder",
    website: "https://ada.example",
    linkedin: "https://linkedin.com/in/ada",
    visibility: "public",
    appearOnRoster: true,
    showAvatar: true,
    showBio: true,
    showSocial: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function privacy(subjects?: { erased?: string[] }) {
  const erased = subjects?.erased ?? [];
  const events = createMemoryEvents();
  return {
    events,
    erased,
    service: createPrivacyService({
      events,
      listRegistrations: async () => [],
      profiles: {
        getOrganizer: async () => null,
        getAttendee: async () => null,
        upsertOrganizer: async (item) => item,
        upsertAttendee: async (item) => item,
      },
      consents: memoryConsents(),
      deletions: memoryDeletions(),
      processing: memoryProcessing(),
      ccpa: memoryCcpa(),
      audit: memoryPrivacyAudit(),
      captcha: createMemoryCaptchaVerifier({ id: "ok", answer: "4" }),
      subjects: {
        async getExportPayload(userId) {
          return { profile: { userId, email: `${userId}@example.com` }, registrations: [] };
        },
        async eraseSubject(userId) {
          erased.push(userId);
        },
      },
      clock: { now: () => now },
    }),
  };
}

describe("privacy and security", () => {
  it("hides the roster by default and never leaks email", () => {
    const hidden = buildRoster({
      event: event(),
      registrations: [registration()],
      profiles: new Map([["user_ada", profile()]]),
      viewer: { userId: "user_other" },
    });
    expect(hidden.visible).toBe(false);
    expect(hidden.entries).toEqual([]);

    const visible = buildRoster({
      event: event({ rosterMode: "visible" }),
      registrations: [registration()],
      profiles: new Map([["user_ada", profile()]]),
      viewer: { userId: "user_other" },
    });
    expect(visible.entries[0]?.displayName).toBe("Ada");
    expect(JSON.stringify(visible.entries)).not.toMatch(/ada@example.com/i);
    expect(visible.entries[0]).not.toHaveProperty("email");
  });

  it("anonymizes public roster entries and keeps anonymous RSVP unnamed", () => {
    const view = buildRoster({
      event: event({ rosterMode: "anonymized" }),
      registrations: [
        registration({ id: "reg_a", anonymous: true, appearOnRoster: true }),
        registration({ id: "reg_b", userId: "user_ada", appearOnRoster: true }),
      ],
      profiles: new Map([["user_ada", profile()]]),
      viewer: {},
    });
    expect(view.entries.map((item) => item.displayName)).toEqual(["Attendee 1", "Attendee 2"]);
    expect(view.entries.every((item) => item.avatarUrl == null)).toBe(true);
  });

  it("blocks cross-tenant staff roster access", () => {
    const view = buildRoster({
      event: event({ rosterMode: "visible" }),
      registrations: [registration()],
      profiles: new Map([["user_ada", profile()]]),
      viewer: { userId: "user_staff", organizationId: "org_b", canReadRegistrants: true },
    });
    expect(view.entries[0]?.displayName).toBe("Ada");
    expect(view.entries[0]).not.toHaveProperty("email");

    const hiddenForeign = buildRoster({
      event: event(),
      registrations: [registration()],
      profiles: new Map([["user_ada", profile()]]),
      viewer: { userId: "user_staff", organizationId: "org_b", canReadRegistrants: true },
    });
    expect(hiddenForeign.visible).toBe(false);
    expect(hiddenForeign.entries).toHaveLength(0);
  });

  it("rejects unauthorized export and deletion (IDOR)", async () => {
    const { service } = privacy();
    await expect(service.exportData("user_1", "user_2", "json")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.exportData("user_1", "user_2", "portability")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(service.requestDeletion("user_1", "user_2")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("exports the subject's JSON and processes deletion within the SLA", async () => {
    let current = now;
    const erased: string[] = [];
    const events = createMemoryEvents();
    const service = createPrivacyService({
      events,
      listRegistrations: async () => [],
      profiles: {
        getOrganizer: async () => null,
        getAttendee: async () => null,
        upsertOrganizer: async (item) => item,
        upsertAttendee: async (item) => item,
      },
      consents: memoryConsents(),
      deletions: memoryDeletions(),
      processing: memoryProcessing(),
      ccpa: memoryCcpa(),
      audit: memoryPrivacyAudit(),
      captcha: createMemoryCaptchaVerifier(),
      subjects: {
        async getExportPayload(userId) {
          return { profile: { userId }, registrations: [{ eventId: "evt_1" }] };
        },
        async eraseSubject(userId) {
          erased.push(userId);
        },
      },
      clock: { now: () => current },
    });

    const exported = await service.exportData("user_1", "user_1", "json");
    expect(exported.subjectUserId).toBe("user_1");
    expect(exported.data.registrations).toHaveLength(1);
    expect(exported.data.ccpa.saleOptOut).toBe(true);

    const portable = await service.exportData("user_1", "user_1", "portability");
    expect(portable.format).toBe("portability");

    const request = await service.requestDeletion("user_1", "user_1");
    expect(request.dueAt.getTime() - request.requestedAt.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(await service.processDueDeletions()).toEqual([]);

    current = request.dueAt;
    const processed = await service.processDueDeletions();
    expect(processed[0]?.status).toBe("completed");
    expect(erased).toEqual(["user_1"]);
  });

  it("prevents roster-mode permission escalation", () => {
    expect(() => assertCanMutateRosterMode(false)).toThrow(ForbiddenError);
    expect(() => assertCanMutateRosterMode(true)).not.toThrow();
  });

  it("rate-limits repeated auth and RSVP attempts", () => {
    resetVelocity();
    incrementVelocity({ key: "rsvp:1.1.1.1", limit: 3, windowMs: 60_000, now: now.getTime() });
    incrementVelocity({ key: "rsvp:1.1.1.1", limit: 3, windowMs: 60_000, now: now.getTime() });
    incrementVelocity({ key: "rsvp:1.1.1.1", limit: 3, windowMs: 60_000, now: now.getTime() });
    expect(() =>
      incrementVelocity({ key: "rsvp:1.1.1.1", limit: 3, windowMs: 60_000, now: now.getTime() }),
    ).toThrow(RateLimitedError);
  });

  it("requires CAPTCHA and triggers 3DS from risk signals", async () => {
    const captcha = createMemoryCaptchaVerifier({ id: "ok", answer: "4" });
    await captcha.issue();
    await expect(captcha.verify({ id: "ok", answer: "9", action: "signup" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await captcha.issue();
    await captcha.verify({ id: "ok", answer: "4", action: "signup" });

    const risky = assessPaymentRisk({
      amountCents: 12_000,
      currency: "EUR",
      velocityHits: 4,
      billingCountry: "FR",
      ipCountry: "US",
      accountAgeMs: 60_000,
    });
    expect(risky.require3ds).toBe(true);
    expect(risky.signals).toEqual(expect.arrayContaining(["high_amount", "country_mismatch", "velocity"]));

    const safe = assessPaymentRisk({ amountCents: 500, currency: "EUR", velocityHits: 0 });
    expect(safe.require3ds).toBe(false);
  });

  it("never enables data sale and records CCPA opt-out", async () => {
    const { service } = privacy();
    await expect(
      service.recordConsent({ userId: "user_1", purpose: "data_sale", granted: true, source: "test" }),
    ).rejects.toBeInstanceOf(ValidationError);
    const settings = await service.optOutOfSale("user_1");
    expect(settings.saleOptOut).toBe(true);
    expect(service.disclosure().sellsPersonalInformation).toBe(false);
    expect(service.dpa().dataSaleAllowed).toBe(false);
  });
});
