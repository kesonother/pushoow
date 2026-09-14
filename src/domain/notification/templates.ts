import type {
  EmailTemplateKey,
  NotificationChannel,
  NotificationTemplate,
  WhatsAppTemplateKey,
} from "@/domain/notification/types";

type Builtin = {
  key: string;
  channel: NotificationChannel;
  locale: string;
  version: number;
  subject: string | null;
  body: string;
};

const EMAIL_V1: Record<EmailTemplateKey, { subject: string; body: string }> = {
  registration_confirmation: {
    subject: "You're registered for {{eventTitle}}",
    body: "Hello,\n\nYour registration for {{eventTitle}} is confirmed.\nWhen: {{startsAt}}\n\nSee you there.",
  },
  reminder_24h: {
    subject: "{{eventTitle}} is tomorrow",
    body: "Reminder: {{eventTitle}} starts in 24 hours ({{startsAt}}, {{timezone}}).",
  },
  reminder_1h: {
    subject: "{{eventTitle}} starts in one hour",
    body: "Reminder: {{eventTitle}} starts in one hour ({{startsAt}}, {{timezone}}).",
  },
  event_update: {
    subject: "{{eventTitle}} was updated",
    body: "An update was published for {{eventTitle}}.\n{{details}}",
  },
  cancellation: {
    subject: "{{eventTitle}} was cancelled",
    body: "{{eventTitle}} has been cancelled. {{details}}",
  },
  receipt: {
    subject: "Receipt for {{eventTitle}}",
    body: "Thank you. Your receipt for {{eventTitle}} is {{amount}}.",
  },
  subscriber_welcome: {
    subject: "Welcome to {{calendarName}}",
    body: "You are subscribed to {{calendarName}}. You can unsubscribe at any time.",
  },
};

const SMS_V1: Record<string, string> = {
  registration_confirmation: "{{eventTitle}} is confirmed. {{startsAt}}",
  reminder_24h: "Reminder: {{eventTitle}} in 24h ({{timezone}}).",
  reminder_1h: "Reminder: {{eventTitle}} in 1h ({{timezone}}).",
  event_update: "Update: {{eventTitle}}. {{details}}",
  cancellation: "URGENT: {{eventTitle}} was cancelled. {{details}}",
};

const WHATSAPP_V1: Record<WhatsAppTemplateKey, string> = {
  confirmation: "event_confirmation",
  reminder: "event_reminder",
  update: "event_update",
  cancellation: "event_cancellation",
};

export const APPROVED_WHATSAPP_TEMPLATES = WHATSAPP_V1;

export function builtinTemplates(): NotificationTemplate[] {
  const now = new Date(0);
  const email = (Object.entries(EMAIL_V1) as Array<[EmailTemplateKey, { subject: string; body: string }]>).map(
    ([key, value]) => ({
      id: `builtin-email-${key}-1`,
      key,
      channel: "email" as const,
      locale: "en",
      version: 1,
      subject: value.subject,
      body: value.body,
      status: "published" as const,
      createdAt: now,
    }),
  );
  const sms = Object.entries(SMS_V1).map(([key, body]) => ({
    id: `builtin-sms-${key}-1`,
    key,
    channel: "sms" as const,
    locale: "en",
    version: 1,
    subject: null,
    body,
    status: "published" as const,
    createdAt: now,
  }));
  const whatsapp = (Object.entries(WHATSAPP_V1) as Array<[WhatsAppTemplateKey, string]>).map(([key, name]) => ({
    id: `builtin-wa-${key}-1`,
    key,
    channel: "whatsapp" as const,
    locale: "en",
    version: 1,
    subject: null,
    body: name,
    status: "published" as const,
    createdAt: now,
  }));
  return [...email, ...sms, ...whatsapp];
}

export function latestPublished(
  templates: NotificationTemplate[],
  key: string,
  channel: NotificationChannel,
  locale = "en",
): NotificationTemplate | null {
  return (
    templates
      .filter(
        (item) =>
          item.key === key &&
          item.channel === channel &&
          item.status === "published" &&
          item.locale === locale,
      )
      .sort((a, b) => b.version - a.version)[0] ??
    templates
      .filter((item) => item.key === key && item.channel === channel && item.status === "published")
      .sort((a, b) => b.version - a.version)[0] ??
    null
  );
}

export function renderTemplate(
  template: Pick<NotificationTemplate, "subject" | "body">,
  vars: Record<string, string>,
): { subject: string | null; body: string } {
  const replace = (value: string) =>
    value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? "");
  return {
    subject: template.subject ? replace(template.subject) : null,
    body: replace(template.body),
  };
}

export function listUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export type { Builtin };
