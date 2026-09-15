export const NOTIFICATION_CHANNELS = [
  "email",
  "sms",
  "whatsapp",
  "web_push",
  "mobile_push",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CATEGORIES = [
  "transactional",
  "reminder",
  "event_update",
  "cancellation",
  "new_event",
  "marketing",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const EMAIL_TEMPLATE_KEYS = [
  "registration_confirmation",
  "reminder_24h",
  "reminder_1h",
  "event_update",
  "cancellation",
  "receipt",
  "subscriber_welcome",
  "billing_renewal",
  "billing_cancellation",
  "billing_payment_failed",
  "billing_refund",
  "support_ticket_opened",
  "support_ticket_reply",
  "welcome_day0",
  "welcome_create_calendar",
  "welcome_first_event",
  "reengagement_inactive",
  "feature_education",
  "product_newsletter_optin",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export const WHATSAPP_TEMPLATE_KEYS = [
  "confirmation",
  "reminder",
  "update",
  "cancellation",
] as const;
export type WhatsAppTemplateKey = (typeof WHATSAPP_TEMPLATE_KEYS)[number];

export const PUSH_CATEGORIES = ["new_event", "reminder", "update"] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];

export const SUPPRESSION_REASONS = [
  "bounce",
  "complaint",
  "unsubscribe",
  "stop",
] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export const SMS_CONSENT_STATUSES = ["opted_in", "opted_out"] as const;
export type SmsConsentStatus = (typeof SMS_CONSENT_STATUSES)[number];

export type NotificationPreference = {
  id: string;
  userId: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  enabled: boolean;
  trackingConsent: boolean;
  updatedAt: Date;
};

export type NotificationSuppression = {
  id: string;
  channel: NotificationChannel;
  address: string;
  reason: SuppressionReason;
  createdAt: Date;
};

export type NotificationTemplate = {
  id: string;
  key: string;
  channel: NotificationChannel;
  locale: string;
  version: number;
  subject: string | null;
  body: string;
  status: "draft" | "published";
  createdAt: Date;
};

export type NotificationDelivery = {
  id: string;
  userId: string | null;
  channel: NotificationChannel;
  category: NotificationCategory;
  templateKey: string;
  to: string;
  subject: string | null;
  body: string;
  status: "queued" | "sent" | "failed" | "suppressed" | "skipped";
  idempotencyKey: string;
  providerMessageId: string | null;
  variant: "a" | "b" | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  trackingEnabled: boolean;
  createdAt: Date;
};

export type SmsConsent = {
  id: string;
  userId: string | null;
  phone: string;
  status: SmsConsentStatus;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PushSubscription = {
  id: string;
  userId: string;
  kind: "web" | "mobile";
  endpoint: string;
  createdAt: Date;
};

export type OutboundMessage = {
  channel: NotificationChannel;
  to: string;
  subject?: string;
  body: string;
  templateKey?: string;
  locale?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
};

export type ProviderResult = {
  providerMessageId: string | null;
};

export type NotificationProvider = {
  channel: NotificationChannel;
  isConfigured: () => boolean;
  send: (message: OutboundMessage) => Promise<ProviderResult>;
};

export class ProviderNotConfiguredError extends Error {
  constructor(channel: NotificationChannel) {
    super(`Notification provider is not configured for ${channel}`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderFailureError extends Error {
  constructor(channel: NotificationChannel, cause?: string) {
    super(`Notification provider failed for ${channel}${cause ? `: ${cause}` : ""}`);
    this.name = "ProviderFailureError";
  }
}

export type NotificationPreferenceRepository = {
  listByUser: (userId: string) => Promise<NotificationPreference[]>;
  upsert: (preference: NotificationPreference) => Promise<NotificationPreference>;
};

export type NotificationSuppressionRepository = {
  find: (channel: NotificationChannel, address: string) => Promise<NotificationSuppression | null>;
  create: (item: NotificationSuppression) => Promise<NotificationSuppression>;
};

export type NotificationTemplateRepository = {
  listPublished: (key: string, channel: NotificationChannel) => Promise<NotificationTemplate[]>;
};

export type NotificationDeliveryRepository = {
  findByIdempotencyKey: (key: string) => Promise<NotificationDelivery | null>;
  create: (item: NotificationDelivery) => Promise<NotificationDelivery>;
  save: (item: NotificationDelivery) => Promise<NotificationDelivery>;
  listAll?: () => Promise<NotificationDelivery[]>;
};

export type SmsConsentRepository = {
  findByPhone: (phone: string) => Promise<SmsConsent | null>;
  upsert: (item: SmsConsent) => Promise<SmsConsent>;
};

export type NewsletterBlock =
  | { type: "title"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "event_embed"; eventId: string; title?: string }
  | { type: "image"; src: string; alt: string }
  | { type: "divider" }
  | { type: "button"; label: string; href: string };

export type Newsletter = {
  id: string;
  organizationId: string;
  calendarId: string;
  subjectA: string;
  subjectB: string | null;
  blocks: NewsletterBlock[];
  status: "draft" | "scheduled" | "sent";
  createdAt: Date;
  updatedAt: Date;
};

export type NewsletterRepository = {
  create: (item: Newsletter) => Promise<Newsletter>;
  findById: (id: string) => Promise<Newsletter | null>;
  listByCalendar: (calendarId: string) => Promise<Newsletter[]>;
  save: (item: Newsletter) => Promise<Newsletter>;
};

export function normalizeAddress(channel: NotificationChannel, value: string): string {
  const trimmed = value.trim();
  if (channel === "email") return trimmed.toLowerCase();
  return trimmed.replace(/\s+/g, "");
}

export function templateCategory(key: string): NotificationCategory {
  if (
    key === "registration_confirmation" ||
    key === "receipt" ||
    key === "confirmation" ||
    key === "billing_renewal" ||
    key === "billing_cancellation" ||
    key === "billing_payment_failed" ||
    key === "billing_refund" ||
    key === "support_ticket_opened" ||
    key === "support_ticket_reply" ||
    key === "welcome_day0" ||
    key === "welcome_create_calendar" ||
    key === "welcome_first_event" ||
    key === "product_newsletter_optin"
  ) {
    return "transactional";
  }
  if (key === "reminder_24h" || key === "reminder_1h" || key === "reminder") return "reminder";
  if (key === "event_update" || key === "update") return "event_update";
  if (key === "cancellation") return "cancellation";
  if (key === "new_event") return "new_event";
  return "marketing";
}

export function isMarketingCategory(category: NotificationCategory): boolean {
  return category === "marketing" || category === "new_event";
}
