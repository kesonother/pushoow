export const REFERRAL_KINDS = ["organizer", "attendee"] as const;
export type ReferralKind = (typeof REFERRAL_KINDS)[number];

export const CONVERSION_STATUSES = ["attributed", "eligible", "granted", "rejected", "blocked"] as const;
export type ConversionStatus = (typeof CONVERSION_STATUSES)[number];

export const REWARD_STATUSES = ["none", "pending", "granted"] as const;
export type RewardStatus = (typeof REWARD_STATUSES)[number];

export const REFERRAL_COOKIE = "pushoow.ref";
export const REFERRAL_CODE_PATTERN = /^[A-Z2-9]{8}$/;

export type ReferralCode = {
  id: string;
  code: string;
  kind: ReferralKind;
  userId: string;
  organizationId: string | null;
  eventId: string | null;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ReferralConversion = {
  id: string;
  codeId: string;
  kind: ReferralKind;
  referrerUserId: string;
  refereeUserId: string | null;
  refereeEmail: string | null;
  eventId: string | null;
  organizationId: string | null;
  visitorHash: string | null;
  status: ConversionStatus;
  rewardStatus: RewardStatus;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReferralCodeRepository = {
  create: (item: ReferralCode) => Promise<ReferralCode>;
  save: (item: ReferralCode) => Promise<ReferralCode>;
  findByCode: (code: string) => Promise<ReferralCode | null>;
  findOrganizerByUser: (userId: string) => Promise<ReferralCode | null>;
  findAttendeeByUserAndEvent: (userId: string, eventId: string) => Promise<ReferralCode | null>;
};

export type ReferralConversionRepository = {
  create: (item: ReferralConversion) => Promise<ReferralConversion>;
  save: (item: ReferralConversion) => Promise<ReferralConversion>;
  listByCode: (codeId: string) => Promise<ReferralConversion[]>;
  listByReferrer: (userId: string) => Promise<ReferralConversion[]>;
  findByRefereeAndKind: (userId: string, kind: ReferralKind, eventId?: string | null) => Promise<ReferralConversion | null>;
};

export type ReferralSnapshot = {
  code: ReferralCode;
  link: string;
  conversions: ReferralConversion[];
  clicks: number;
  attributed: number;
  eligible: number;
  granted: number;
  blocked: number;
};
