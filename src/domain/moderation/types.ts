export const MODERATION_TYPES = [
  "warning",
  "temporary_suspension",
  "permanent_ban",
] as const;
export type ModerationType = (typeof MODERATION_TYPES)[number];

export const MODERATION_REASON_CATEGORIES = [
  "policy",
  "abuse",
  "fraud",
  "illegal",
  "other",
] as const;
export type ModerationReasonCategory = (typeof MODERATION_REASON_CATEGORIES)[number];

export const APPEAL_STATUSES = ["none", "submitted", "accepted", "rejected"] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export type ModerationAction = {
  id: string;
  userId: string;
  type: ModerationType;
  reason: string;
  reasonCategory: ModerationReasonCategory;
  immediate: boolean;
  noticeAt: Date;
  startsAt: Date;
  endsAt: Date | null;
  createdByUserId: string | null;
  notifiedAt: Date | null;
  appealStatus: AppealStatus;
  appealReason: string | null;
  appealedAt: Date | null;
  appealResolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ModerationRepository = {
  create: (action: ModerationAction) => Promise<ModerationAction>;
  listByUser: (userId: string) => Promise<ModerationAction[]>;
  findById: (id: string) => Promise<ModerationAction | null>;
  save: (action: ModerationAction) => Promise<ModerationAction>;
};

export const DEFAULT_NOTICE_DAYS = 7;
export const IMMEDIATE_CATEGORIES: readonly ModerationReasonCategory[] = [
  "fraud",
  "illegal",
];
