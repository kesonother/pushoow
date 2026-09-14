export const IMPORT_KINDS = ["guests", "subscribers", "events", "calendar"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORT_STATUSES = ["uploaded", "mapped", "validated", "committed", "purged"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const IMPORT_FIELDS = [
  "email",
  "name",
  "ticketType",
  "status",
  "createdAt",
  "title",
  "startsAt",
  "endsAt",
  "timezone",
  "description",
  "venue",
  "city",
  "tags",
  "website",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_ERROR_CODES = [
  "duplicate_email",
  "invalid_email",
  "missing_required",
  "invalid_date",
  "invalid_ticket_type",
] as const;
export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[number];

export const IMPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const IMPORT_MAX_BYTES = 1_500_000;
export const IMPORT_MAX_ROWS = 5_000;

export type ImportMapping = Partial<Record<ImportField, string>>;

export type ImportError = {
  row: number;
  email: string | null;
  field: ImportField | "row";
  code: ImportErrorCode;
  message: string;
};

export type ImportReport = {
  imported: number;
  skipped: number;
  errors: ImportError[];
};

export type ImportJob = {
  id: string;
  organizationId: string;
  actorUserId: string;
  kind: ImportKind;
  calendarId: string | null;
  eventId: string | null;
  targetKey: string;
  filename: string;
  contentHash: string;
  ciphertext: string;
  byteSize: number;
  status: ImportStatus;
  mapping: ImportMapping;
  report: ImportReport | null;
  purgeAfter: Date;
  purgedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ImportPublicView = Omit<ImportJob, "ciphertext"> & {
  headers: string[];
  sample: string[][];
  suggestedMapping: ImportMapping;
  rowCount: number;
};

export type ImportPreviewRow = {
  row: number;
  values: Record<string, string>;
};

export type ImportRepository = {
  create: (job: ImportJob) => Promise<ImportJob>;
  findById: (id: string) => Promise<ImportJob | null>;
  findByHash: (input: {
    organizationId: string;
    kind: ImportKind;
    targetKey: string;
    contentHash: string;
  }) => Promise<ImportJob | null>;
  save: (job: ImportJob) => Promise<ImportJob>;
  listExpired: (now: Date) => Promise<ImportJob[]>;
};
