import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { assertSameTenant } from "@/domain/tenant/isolation";
import type { CalendarRepository } from "@/domain/calendar/types";
import {
  MAX_TIERS_PER_CALENDAR,
  PaymentNotConfiguredError,
  TIER_KINDS,
  type CalendarMember,
  type CalendarMemberRepository,
  type CalendarMembershipTier,
  type CalendarMembershipTierRepository,
  type MembershipStatus,
  type PaymentAdapter,
  type TierKind,
} from "@/domain/calendar/membership-types";
import { unconfiguredPaymentAdapter } from "@/integrations/payments/unconfigured";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export type MembershipNotifier = {
  notify: (input: {
    userId?: string;
    subject: string;
    body: string;
    organizationId: string;
    kind: "membership.requested" | "membership.approved" | "membership.rejected" | "membership.payment";
  }) => Promise<void>;
};

export type MembershipServiceDeps = {
  calendars: CalendarRepository;
  tiers: CalendarMembershipTierRepository;
  members: CalendarMemberRepository;
  payments?: PaymentAdapter;
  notify?: MembershipNotifier;
  clock?: Clock;
  ids?: IdGenerator;
};

export type TierWriteInput = {
  name: string;
  kind: TierKind;
  visibility?: "public" | "members";
  memberOnlyTickets?: boolean;
  newsletters?: boolean;
  earlyRsvp?: boolean;
  requiresApproval?: boolean;
  priceCents?: number | null;
  currency?: string | null;
  interval?: "month" | "year" | null;
  sortOrder?: number;
};

function assertPaidKind(kind: TierKind): boolean {
  return kind === "one_time" || kind === "subscription";
}

function validateTierInput(input: TierWriteInput) {
  if (input.name.trim().length < 2) {
    throw new ValidationError("Tier name is too short");
  }
  if (!TIER_KINDS.includes(input.kind)) {
    throw new ValidationError("Unknown membership tier kind");
  }
  if (assertPaidKind(input.kind)) {
    if (!input.priceCents || input.priceCents < 1) {
      throw new ValidationError("Paid tiers require a price");
    }
    if (!input.currency) {
      throw new ValidationError("Paid tiers require a currency");
    }
    if (input.kind === "subscription" && !input.interval) {
      throw new ValidationError("Subscription tiers require an interval");
    }
  }
}

function initialStatus(tier: CalendarMembershipTier): MembershipStatus {
  if (tier.requiresApproval) return "pending";
  if (assertPaidKind(tier.kind)) return "awaiting_payment";
  return "active";
}

export function createMembershipService(deps: MembershipServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const payments = deps.payments ?? unconfiguredPaymentAdapter;

  async function requireCalendar(actor: Actor, calendarId: string) {
    const calendar = await deps.calendars.findById(calendarId);
    assertSameTenant(calendar, actor.organizationId, "Calendar");
    return calendar!;
  }

  async function createTier(
    actor: Actor,
    calendarId: string,
    input: TierWriteInput,
  ): Promise<CalendarMembershipTier> {
    assertPermission(actor, "calendars:update");
    const calendar = await requireCalendar(actor, calendarId);
    validateTierInput(input);
    const existing = await deps.tiers.listByCalendar(calendar.id);
    if (existing.length >= MAX_TIERS_PER_CALENDAR) {
      throw new ValidationError("A calendar can have at most 5 membership tiers");
    }

    const now = clock.now();
    return deps.tiers.create({
      id: ids.id(),
      organizationId: calendar.organizationId,
      calendarId: calendar.id,
      name: input.name.trim(),
      kind: input.kind,
      visibility: input.visibility ?? "public",
      memberOnlyTickets: input.memberOnlyTickets ?? false,
      newsletters: input.newsletters ?? false,
      earlyRsvp: input.earlyRsvp ?? false,
      requiresApproval: input.requiresApproval ?? false,
      priceCents: assertPaidKind(input.kind) ? input.priceCents ?? null : null,
      currency: assertPaidKind(input.kind) ? input.currency?.toUpperCase() ?? null : null,
      interval: input.kind === "subscription" ? input.interval ?? null : null,
      sortOrder: input.sortOrder ?? existing.length,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function listTiers(calendarId: string): Promise<CalendarMembershipTier[]> {
    const calendar = await deps.calendars.findById(calendarId);
    if (!calendar || calendar.deletedAt) {
      throw new NotFoundError("Calendar", calendarId);
    }
    const tiers = await deps.tiers.listByCalendar(calendarId);
    return tiers.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async function updateTier(
    actor: Actor,
    tierId: string,
    input: Partial<TierWriteInput>,
  ): Promise<CalendarMembershipTier> {
    assertPermission(actor, "calendars:update");
    const tier = await deps.tiers.findById(tierId);
    if (!tier) throw new NotFoundError("CalendarMembershipTier", tierId);
    await requireCalendar(actor, tier.calendarId);
    const next: TierWriteInput = {
      name: input.name ?? tier.name,
      kind: input.kind ?? tier.kind,
      visibility: input.visibility ?? tier.visibility,
      memberOnlyTickets: input.memberOnlyTickets ?? tier.memberOnlyTickets,
      newsletters: input.newsletters ?? tier.newsletters,
      earlyRsvp: input.earlyRsvp ?? tier.earlyRsvp,
      requiresApproval: input.requiresApproval ?? tier.requiresApproval,
      priceCents: input.priceCents === undefined ? tier.priceCents : input.priceCents,
      currency: input.currency === undefined ? tier.currency : input.currency,
      interval: input.interval === undefined ? tier.interval : input.interval,
      sortOrder: input.sortOrder ?? tier.sortOrder,
    };
    validateTierInput(next);
    return deps.tiers.save({
      ...tier,
      ...next,
      name: next.name.trim(),
      currency: assertPaidKind(next.kind) ? next.currency?.toUpperCase() ?? null : null,
      priceCents: assertPaidKind(next.kind) ? next.priceCents ?? null : null,
      interval: next.kind === "subscription" ? next.interval ?? null : null,
      updatedAt: clock.now(),
    });
  }

  async function deleteTier(actor: Actor, tierId: string): Promise<void> {
    assertPermission(actor, "calendars:update");
    const tier = await deps.tiers.findById(tierId);
    if (!tier) throw new NotFoundError("CalendarMembershipTier", tierId);
    await requireCalendar(actor, tier.calendarId);
    await deps.tiers.delete(tier.id);
  }

  async function requestJoin(
    userId: string,
    calendarId: string,
    tierId: string,
  ): Promise<CalendarMember> {
    const calendar = await deps.calendars.findById(calendarId);
    if (!calendar || calendar.deletedAt) {
      throw new NotFoundError("Calendar", calendarId);
    }
    const tier = await deps.tiers.findById(tierId);
    if (!tier || tier.calendarId !== calendar.id) {
      throw new NotFoundError("CalendarMembershipTier", tierId);
    }

    const existing = await deps.members.findByUserAndCalendar(userId, calendar.id);
    if (existing) {
      if (existing.status === "rejected") {
        const now = clock.now();
        const status = initialStatus(tier);
        const updated = await deps.members.save({
          ...existing,
          tierId: tier.id,
          status,
          paymentExternalId: null,
          decidedAt: null,
          updatedAt: now,
        });
        if (status === "pending") {
          await deps.notify?.notify({
            userId,
            organizationId: calendar.organizationId,
            kind: "membership.requested",
            subject: `Membership requested: ${calendar.name}`,
            body: `A membership request is pending approval for ${calendar.name}. Payment will not be collected until approval.`,
          });
        }
        return updated;
      }
      throw new ConflictError("You already have a membership for this calendar", {
        status: existing.status,
      });
    }

    const now = clock.now();
    const status = initialStatus(tier);
    const member = await deps.members.create({
      id: ids.id(),
      organizationId: calendar.organizationId,
      calendarId: calendar.id,
      userId,
      tierId: tier.id,
      status,
      paymentExternalId: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    if (status === "pending") {
      await deps.notify?.notify({
        userId,
        organizationId: calendar.organizationId,
        kind: "membership.requested",
        subject: `Membership requested: ${calendar.name}`,
        body: `A membership request is pending approval for ${calendar.name}. Payment will not be collected until approval.`,
      });
    }

    return member;
  }

  async function decide(
    actor: Actor,
    membershipId: string,
    decision: "approved" | "rejected",
  ): Promise<CalendarMember> {
    assertPermission(actor, "members:update");
    const member = await deps.members.findById(membershipId);
    if (!member) throw new NotFoundError("CalendarMember", membershipId);
    assertSameTenant(member, actor.organizationId, "CalendarMember");
    if (member.status !== "pending") {
      throw new ConflictError("Only pending memberships can be decided");
    }

    const tier = await deps.tiers.findById(member.tierId);
    if (!tier) throw new NotFoundError("CalendarMembershipTier", member.tierId);

    const now = clock.now();
    let status: MembershipStatus = "rejected";
    if (decision === "approved") {
      status = assertPaidKind(tier.kind) ? "awaiting_payment" : "active";
    }

    const updated = await deps.members.save({
      ...member,
      status,
      decidedAt: now,
      updatedAt: now,
    });

    await deps.notify?.notify({
      userId: member.userId,
      organizationId: member.organizationId,
      kind: decision === "approved" ? "membership.approved" : "membership.rejected",
      subject:
        decision === "approved"
          ? "Your calendar membership was approved"
          : "Your calendar membership was rejected",
      body:
        status === "awaiting_payment"
          ? "Your membership was approved. Complete payment to activate access. No charge was taken before approval."
          : decision === "approved"
            ? "Your membership is now active."
            : "Your membership request was rejected.",
    });

    return updated;
  }

  async function startPayment(
    userId: string,
    membershipId: string,
    urls: { successUrl: string; cancelUrl: string },
  ): Promise<{ checkoutUrl: string; membership: CalendarMember }> {
    const member = await deps.members.findById(membershipId);
    if (!member || member.userId !== userId) {
      throw new NotFoundError("CalendarMember", membershipId);
    }
    if (member.status !== "awaiting_payment") {
      throw new ConflictError("This membership is not awaiting payment");
    }
    const tier = await deps.tiers.findById(member.tierId);
    if (!tier || !tier.priceCents || !tier.currency) {
      throw new ValidationError("This tier is not payable");
    }
    if (!payments.isConfigured()) {
      throw new PaymentNotConfiguredError();
    }

    const checkout = await payments.createCheckout({
      membershipId: member.id,
      amountCents: tier.priceCents,
      currency: tier.currency,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    });

    const updated = await deps.members.save({
      ...member,
      paymentExternalId: checkout.externalId,
      updatedAt: clock.now(),
    });

    await deps.notify?.notify({
      userId,
      organizationId: member.organizationId,
      kind: "membership.payment",
      subject: "Complete your calendar membership payment",
      body: "Your membership was approved. Checkout is ready — payment was not collected before approval.",
    });

    return { checkoutUrl: checkout.checkoutUrl, membership: updated };
  }

  async function listMembers(actor: Actor, calendarId: string): Promise<CalendarMember[]> {
    assertPermission(actor, "members:read");
    await requireCalendar(actor, calendarId);
    return deps.members.listByCalendar(calendarId);
  }

  async function getMembership(
    userId: string,
    calendarId: string,
  ): Promise<CalendarMember | null> {
    return deps.members.findByUserAndCalendar(userId, calendarId);
  }

  return {
    createTier,
    listTiers,
    updateTier,
    deleteTier,
    requestJoin,
    decide,
    startPayment,
    listMembers,
    getMembership,
  };
}
