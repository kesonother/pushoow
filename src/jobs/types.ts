export const JOB_TYPES = [
  "email.send",
  "sms.send",
  "whatsapp.send",
  "web_push.send",
  "mobile_push.send",
  "reminder.dispatch",
  "reminder.schedule",
  "newsletter.send",
  "webhook.deliver",
  "export.generate",
  "report.generate",
  "ai.process",
  "sync.run",
  "calendar.followers.notify",
  "waitlist.expire",
  "chat.archive",
  "privacy.deletion.process",
  "import.purge",
  "audit.purge",
  "billing.renewal.process",
  "billing.renewal.notify",
  "billing.grace.expire",
  "support.sla.tick",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "dead",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobRecord = {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JobRepository = {
  create: (job: JobRecord) => Promise<JobRecord>;
  findByIdempotencyKey: (key: string) => Promise<JobRecord | null>;
  claimNext: (now: Date) => Promise<JobRecord | null>;
  save: (job: JobRecord) => Promise<JobRecord>;
};

export function backoffMs(attempts: number): number {
  return Math.min(60_000, 500 * 2 ** Math.max(0, attempts - 1));
}
