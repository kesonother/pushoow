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
  billing_renewal: {
    subject: "Your Pushoow subscription renews soon",
    body: "{{details}}",
  },
  billing_cancellation: {
    subject: "Your Pushoow subscription cancellation is confirmed",
    body: "{{details}}",
  },
  billing_payment_failed: {
    subject: "Payment failed for your Pushoow subscription",
    body: "{{details}}",
  },
  billing_refund: {
    subject: "Your Pushoow refund was issued",
    body: "{{details}}",
  },
  support_ticket_opened: {
    subject: "New support ticket",
    body: "{{details}}",
  },
  support_ticket_reply: {
    subject: "New reply on a support ticket",
    body: "{{details}}",
  },
  welcome_day0: {
    subject: "Welcome to Pushoow",
    body: "Your account is ready. Create a calendar, add your first event, publish, then share the public link.",
  },
  welcome_create_calendar: {
    subject: "Create your first calendar",
    body: "A Meetup template is ready. Create your first calendar to start hosting.",
  },
  welcome_first_event: {
    subject: "Publish your First Meetup",
    body: "Use the First Meetup template, publish the event, then share the public page.",
  },
  reengagement_inactive: {
    subject: "Your community is waiting",
    body: "You have not published yet. Come back to create a calendar or RSVP to an event.",
  },
  feature_education: {
    subject: "Discover, follow, and check in",
    body: "Find public events, follow calendars you care about, and use check-in at the door.",
  },
  product_newsletter_optin: {
    subject: "Want product updates from Pushoow?",
    body: "You can opt in to the product newsletter from your notification preferences. Transactional emails stay on.",
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
