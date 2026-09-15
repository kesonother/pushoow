import { increment } from "@/observability/metrics";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { absoluteUrl, publicOrigin } from "@/lib/public-url";
import { generateReferralCode, normalizeReferralCode } from "./codes";
import type {
  ReferralCode,
  ReferralCodeRepository,
  ReferralConversion,
  ReferralConversionRepository,
  ReferralKind,
  ReferralSnapshot,
} from "./types";

export const MAX_CONVERSIONS_PER_CODE_PER_DAY = 20;

export type ReferralServiceDeps = {
  codes: ReferralCodeRepository;
  conversions: ReferralConversionRepository;
  clock?: Clock;
  ids?: IdGenerator;
  origin?: string;
};

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function createReferralService(deps: ReferralServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const origin = () => deps.origin ?? publicOrigin();

  async function uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateReferralCode();
      if (!(await deps.codes.findByCode(code))) return code;
    }
    return generateReferralCode();
  }

  async function persistCode(input: Omit<ReferralCode, "id" | "code" | "clickCount" | "createdAt" | "updatedAt"> & { code?: string }) {
    const now = clock.now();
    return deps.codes.create({
      id: ids.id(),
      code: input.code ?? (await uniqueCode()),
      kind: input.kind,
      userId: input.userId,
      organizationId: input.organizationId,
      eventId: input.eventId,
      clickCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function ensureOrganizerCode(userId: string, organizationId?: string | null) {
    const existing = await deps.codes.findOrganizerByUser(userId);
    if (existing) return existing;
    return persistCode({ kind: "organizer", userId, organizationId: organizationId ?? null, eventId: null });
  }

  async function ensureAttendeeCode(userId: string, eventId: string) {
    const existing = await deps.codes.findAttendeeByUserAndEvent(userId, eventId);
    if (existing) return existing;
    return persistCode({ kind: "attendee", userId, organizationId: null, eventId });
  }

  function linkFor(code: ReferralCode): string {
    if (code.kind === "attendee" && code.eventId) {
      return absoluteUrl(`/r/${code.code}`, origin());
    }
    return absoluteUrl(`/register?ref=${code.code}`, origin());
  }

  async function snapshot(code: ReferralCode): Promise<ReferralSnapshot> {
    const conversions = await deps.conversions.listByCode(code.id);
    return {
      code,
      link: linkFor(code),
      conversions,
      clicks: code.clickCount,
      attributed: conversions.filter((item) => item.status !== "blocked" && item.status !== "rejected").length,
      eligible: conversions.filter((item) => item.status === "eligible" || item.status === "granted").length,
      granted: conversions.filter((item) => item.rewardStatus === "granted").length,
      blocked: conversions.filter((item) => item.status === "blocked" || item.status === "rejected").length,
    };
  }

  async function resolve(raw: string) {
    const code = normalizeReferralCode(raw);
    if (!code) return null;
    return deps.codes.findByCode(code);
  }

  async function recordClick(raw: string) {
    const found = await resolve(raw);
    if (!found) return null;
    found.clickCount += 1;
    found.updatedAt = clock.now();
    await deps.codes.save(found);
    increment("referral.clicks", { kind: found.kind });
    return found;
  }

  async function blocked(
    input: {
      code: ReferralCode;
      refereeUserId?: string | null;
      refereeEmail?: string | null;
      eventId?: string | null;
      visitorHash?: string | null;
      kind: ReferralKind;
    },
    reason: string,
  ): Promise<ReferralConversion> {
    const now = clock.now();
    const conversion = await deps.conversions.create({
      id: ids.id(),
      codeId: input.code.id,
      kind: input.kind,
      referrerUserId: input.code.userId,
      refereeUserId: input.refereeUserId ?? null,
      refereeEmail: input.refereeEmail ?? null,
      eventId: input.eventId ?? input.code.eventId,
      organizationId: input.code.organizationId,
      visitorHash: input.visitorHash ?? null,
      status: reason === "self" || reason === "velocity" || reason === "duplicate" || reason === "duplicate_visitor" ? "blocked" : "rejected",
      rewardStatus: "none",
      reason,
      createdAt: now,
      updatedAt: now,
    });
    increment("referral.conversions", { kind: input.kind, status: conversion.status });
    return conversion;
  }

  async function fraudReason(input: {
    code: ReferralCode;
    kind: ReferralKind;
    refereeUserId?: string | null;
    eventId?: string | null;
    visitorHash?: string | null;
  }): Promise<string | null> {
    if (input.kind !== input.code.kind) return "kind_mismatch";
    if (input.kind === "attendee" && input.code.eventId && input.eventId && input.code.eventId !== input.eventId) {
      return "event_mismatch";
    }
    if (input.refereeUserId && input.refereeUserId === input.code.userId) return "self";
    if (input.refereeUserId) {
      const existing = await deps.conversions.findByRefereeAndKind(
        input.refereeUserId,
        input.kind,
        input.kind === "attendee" ? input.eventId ?? input.code.eventId : null,
      );
      if (existing && existing.status !== "blocked" && existing.status !== "rejected") return "duplicate";
    }
    const conversions = await deps.conversions.listByCode(input.code.id);
    const day = startOfUtcDay(clock.now()).getTime();
    const today = conversions.filter((item) => item.createdAt.getTime() >= day && item.status !== "blocked");
    if (today.length >= MAX_CONVERSIONS_PER_CODE_PER_DAY) return "velocity";
    if (input.visitorHash) {
      const sameVisitor = conversions.some(
        (item) => item.visitorHash === input.visitorHash && item.status !== "blocked" && item.status !== "rejected",
      );
      if (sameVisitor) return "duplicate_visitor";
    }
    return null;
  }

  async function convert(input: {
    rawCode: string;
    kind: ReferralKind;
    refereeUserId?: string | null;
    refereeEmail?: string | null;
    eventId?: string | null;
    organizationId?: string | null;
    visitorHash?: string | null;
    status: "attributed" | "eligible";
    grant?: boolean;
  }) {
    const code = await resolve(input.rawCode);
    if (!code) return null;
    if (input.refereeUserId) {
      const existing = await deps.conversions.findByRefereeAndKind(
        input.refereeUserId,
        input.kind,
        input.kind === "attendee" ? input.eventId ?? code.eventId : null,
      );
      if (existing && existing.status !== "blocked" && existing.status !== "rejected") {
        if (existing.status === "attributed" && (input.status === "eligible" || input.grant)) {
          const now = clock.now();
          existing.status = input.grant ? "granted" : "eligible";
          existing.rewardStatus = input.grant ? "granted" : "pending";
          existing.organizationId = input.organizationId ?? existing.organizationId;
          existing.eventId = input.eventId ?? existing.eventId;
          existing.updatedAt = now;
          await deps.conversions.save(existing);
          increment("referral.conversions", { kind: input.kind, status: existing.status });
          return existing;
        }
        return existing.status === "granted" || existing.status === "eligible" ? existing : blocked(
          {
            code,
            kind: input.kind,
            refereeUserId: input.refereeUserId,
            refereeEmail: input.refereeEmail,
            eventId: input.eventId,
            visitorHash: input.visitorHash,
          },
          "duplicate",
        );
      }
    }
    const reason = await fraudReason({
      code,
      kind: input.kind,
      refereeUserId: input.refereeUserId,
      eventId: input.eventId,
      visitorHash: input.visitorHash,
    });
    if (reason) {
      return blocked(
        {
          code,
          kind: input.kind,
          refereeUserId: input.refereeUserId,
          refereeEmail: input.refereeEmail,
          eventId: input.eventId,
          visitorHash: input.visitorHash,
        },
        reason,
      );
    }
    const now = clock.now();
    const granted = Boolean(input.grant);
    const conversion = await deps.conversions.create({
      id: ids.id(),
      codeId: code.id,
      kind: input.kind,
      referrerUserId: code.userId,
      refereeUserId: input.refereeUserId ?? null,
      refereeEmail: input.refereeEmail ?? null,
      eventId: input.eventId ?? code.eventId,
      organizationId: input.organizationId ?? code.organizationId,
      visitorHash: input.visitorHash ?? null,
      status: granted ? "granted" : input.status,
      rewardStatus: granted ? "granted" : input.status === "eligible" ? "pending" : "none",
      reason: null,
      createdAt: now,
      updatedAt: now,
    });
    increment("referral.conversions", { kind: input.kind, status: conversion.status });
    return conversion;
  }

  return {
    ensureOrganizerCode,
    ensureAttendeeCode,
    resolve,
    recordClick,
    linkFor,
    snapshot,
    attributeSignup: async (input: {
      code: string;
      userId: string;
      email?: string | null;
      visitorHash?: string | null;
    }) => {
      const found = await resolve(input.code);
      if (!found || found.kind !== "organizer") return null;
      return convert({
        rawCode: input.code,
        kind: "organizer",
        refereeUserId: input.userId,
        refereeEmail: input.email,
        visitorHash: input.visitorHash,
        status: "attributed",
      });
    },
    attributeOrganizer: (input: {
      code: string;
      userId: string;
      organizationId: string;
      visitorHash?: string | null;
    }) =>
      convert({
        rawCode: input.code,
        kind: "organizer",
        refereeUserId: input.userId,
        organizationId: input.organizationId,
        visitorHash: input.visitorHash,
        status: "eligible",
        grant: true,
      }),
    attributeAttendeeRsvp: (input: {
      code: string;
      userId?: string | null;
      email?: string | null;
      eventId: string;
      visitorHash?: string | null;
    }) =>
      convert({
        rawCode: input.code,
        kind: "attendee",
        refereeUserId: input.userId,
        refereeEmail: input.email,
        eventId: input.eventId,
        visitorHash: input.visitorHash,
        status: "eligible",
        grant: true,
      }),
    async forOrganizer(userId: string, organizationId?: string | null) {
      const code = await ensureOrganizerCode(userId, organizationId);
      return snapshot(code);
    },
    async forAttendee(userId: string, eventId: string) {
      const code = await ensureAttendeeCode(userId, eventId);
      return snapshot(code);
    },
  };
}
