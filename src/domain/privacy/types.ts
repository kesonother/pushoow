export const ROSTER_MODES = ["visible", "hidden", "anonymized", "approval_only"] as const;
export type RosterMode = (typeof ROSTER_MODES)[number];
export const DEFAULT_ROSTER_MODE: RosterMode = "hidden";

export const SENSITIVE_ROSTER_FIELDS = ["email", "phone", "address", "dateOfBirth", "ipAddress"] as const;

export const CONSENT_PURPOSES = ["necessary", "marketing", "tracking", "data_sale"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const DELETION_STATUSES = ["pending", "processing", "completed", "rejected"] as const;
export type DeletionStatus = (typeof DELETION_STATUSES)[number];

/** GDPR Art. 12(3) / 17: one month, without undue delay. */
export const DELETION_SLA_MS = 30 * 24 * 60 * 60 * 1000;

export type PrivacyAuditEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  organizationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type ConsentRecord = {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  source: string;
  createdAt: Date;
};

export type DeletionRequest = {
  id: string;
  userId: string;
  status: DeletionStatus;
  requestedAt: Date;
  dueAt: Date;
  processedAt: Date | null;
};

export type DataProcessingRecord = {
  id: string;
  userId: string | null;
  organizationId: string | null;
  purpose: string;
  legalBasis: string;
  categories: string[];
  createdAt: Date;
};

export type DpaMetadata = {
  organizationId: string | null;
  version: string;
  purposes: string[];
  legalBases: string[];
  subprocessors: string[];
  dataSaleAllowed: false;
};

export type CcpaSettings = {
  userId: string;
  saleOptOut: boolean;
  disclosureAcknowledged: boolean;
  updatedAt: Date;
};

export type PrivacyExport = {
  format: "json" | "portability";
  version: 1;
  exportedAt: string;
  subjectUserId: string;
  data: {
    profile: unknown;
    registrations: unknown[];
    consents: ConsentRecord[];
    ccpa: CcpaSettings;
    processingRecords: DataProcessingRecord[];
  };
};

export type RosterViewer = {
  userId?: string | null;
  organizationId?: string | null;
  canReadRegistrants?: boolean;
  approvedAttendee?: boolean;
};

export type RosterEntry = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  linkedin: string | null;
  anonymous: boolean;
};

export type RosterView = {
  mode: RosterMode;
  visible: boolean;
  entries: RosterEntry[];
  count: number;
};

export type PaymentRiskInput = {
  amountCents: number;
  currency: string;
  buyerUserId?: string | null;
  email?: string;
  billingCountry?: string | null;
  ipCountry?: string | null;
  accountAgeMs?: number | null;
  velocityHits: number;
};

export type PaymentRiskResult = {
  score: number;
  signals: string[];
  require3ds: boolean;
};

export type CaptchaChallenge = {
  id: string;
  prompt: string;
  expiresAt: Date;
};

export type CaptchaVerifier = {
  issue: () => Promise<CaptchaChallenge>;
  verify: (input: { id: string; answer: string; action: string }) => Promise<void>;
};

export type PrivacyAuditRepository = {
  append: (entry: PrivacyAuditEntry) => Promise<PrivacyAuditEntry>;
  listByActor: (actorUserId: string) => Promise<PrivacyAuditEntry[]>;
};

export type ConsentRepository = {
  create: (item: ConsentRecord) => Promise<ConsentRecord>;
  listByUser: (userId: string) => Promise<ConsentRecord[]>;
};

export type DeletionRequestRepository = {
  create: (item: DeletionRequest) => Promise<DeletionRequest>;
  findOpenByUser: (userId: string) => Promise<DeletionRequest | null>;
  listDue: (now: Date) => Promise<DeletionRequest[]>;
  save: (item: DeletionRequest) => Promise<DeletionRequest>;
};

export type ProcessingRecordRepository = {
  create: (item: DataProcessingRecord) => Promise<DataProcessingRecord>;
  listByUser: (userId: string) => Promise<DataProcessingRecord[]>;
};

export type CcpaSettingsRepository = {
  findByUser: (userId: string) => Promise<CcpaSettings | null>;
  upsert: (item: CcpaSettings) => Promise<CcpaSettings>;
};

export type PrivacySubjectDirectory = {
  getExportPayload: (userId: string) => Promise<{ profile: unknown; registrations: unknown[] }>;
  eraseSubject: (userId: string, at: Date) => Promise<void>;
};
