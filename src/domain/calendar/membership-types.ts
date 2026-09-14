import { DomainError } from "@/domain/errors";

export const TIER_KINDS = ["free", "one_time", "subscription", "tier_gated"] as const;
export type TierKind = (typeof TIER_KINDS)[number];

export const MEMBERSHIP_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "awaiting_payment",
  "active",
  "cancelled",
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export type CalendarMembershipTier = {
  id: string;
  organizationId: string;
  calendarId: string;
  name: string;
  kind: TierKind;
  visibility: "public" | "members";
  memberOnlyTickets: boolean;
  newsletters: boolean;
  earlyRsvp: boolean;
  requiresApproval: boolean;
  priceCents: number | null;
  currency: string | null;
  interval: "month" | "year" | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CalendarMember = {
  id: string;
  organizationId: string;
  calendarId: string;
  userId: string;
  tierId: string;
  status: MembershipStatus;
  paymentExternalId: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CalendarMembershipTierRepository = {
  create: (tier: CalendarMembershipTier) => Promise<CalendarMembershipTier>;
  findById: (id: string) => Promise<CalendarMembershipTier | null>;
  listByCalendar: (calendarId: string) => Promise<CalendarMembershipTier[]>;
  save: (tier: CalendarMembershipTier) => Promise<CalendarMembershipTier>;
  delete: (id: string) => Promise<void>;
};

export type CalendarMemberRepository = {
  create: (member: CalendarMember) => Promise<CalendarMember>;
  findById: (id: string) => Promise<CalendarMember | null>;
  findByUserAndCalendar: (
    userId: string,
    calendarId: string,
  ) => Promise<CalendarMember | null>;
  listByCalendar: (calendarId: string) => Promise<CalendarMember[]>;
  save: (member: CalendarMember) => Promise<CalendarMember>;
};

export const MAX_TIERS_PER_CALENDAR = 5;

export type PaymentAdapter = {
  isConfigured: () => boolean;
  createCheckout: (input: {
    membershipId: string;
    amountCents: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
    require3ds?: boolean;
    applicationFeeCents?: number;
    connectedAccountId?: string;
    idempotencyKey?: string;
    automaticTax?: boolean;
    lineItems?: Array<{ name: string; quantity: number; unitAmountCents: number }>;
    metadata?: Record<string, string>;
  }) => Promise<{ checkoutUrl: string; externalId: string; paymentIntentId?: string | null }>;
  refund: (input: {
    externalId: string;
    amountCents?: number;
    reason?: string;
    idempotencyKey?: string;
  }) => Promise<{ refundId?: string } | void>;
};

export class PaymentNotConfiguredError extends DomainError {
  constructor() {
    super(
      "VALIDATION",
      "Payment provider is not configured. Paid checkout cannot be started.",
      422,
    );
    this.name = "PaymentNotConfiguredError";
  }
}
