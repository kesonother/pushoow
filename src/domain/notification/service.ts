import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import { pickAbSubject, renderNewsletterHtml } from "@/domain/notification/newsletter";
import { canSend, isStopKeyword, trackingAllowed } from "@/domain/notification/policy";
import { formatInTimezone, reminderSchedule } from "@/domain/notification/reminders";
import {
  APPROVED_WHATSAPP_TEMPLATES,
  builtinTemplates,
  latestPublished,
  listUnsubscribeHeaders,
  renderTemplate,
} from "@/domain/notification/templates";
import {
  normalizeAddress,
  templateCategory,
  type Newsletter,
  type NewsletterBlock,
  type NewsletterRepository,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationDelivery,
  type NotificationDeliveryRepository,
  type NotificationPreference,
  type NotificationPreferenceRepository,
  type NotificationProvider,
  type NotificationSuppressionRepository,
  type NotificationTemplate,
  type NotificationTemplateRepository,
  type SmsConsentRepository,
  type SuppressionReason,
  type WhatsAppTemplateKey,
} from "@/domain/notification/types";
import { ProviderFailureError as ProviderFailed, ProviderNotConfiguredError } from "@/domain/notification/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { consumeRateLimit } from "@/api/rate-limit";
import type { JobType } from "@/jobs/types";
import { decodeJson, encodeJson, safeEqual, signPayload } from "@/lib/token-crypto";

export type EnqueueNotification = (input: {
  type: JobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  availableAt?: Date;
}) => Promise<unknown>;

export type DispatchInput = {
  userId?: string | null;
  channel: NotificationChannel;
  to: string;
  templateKey: string;
  vars?: Record<string, string>;
  locale?: string;
  marketingConsent?: boolean;
  idempotencyKey: string;
  subjectOverride?: string;
  bodyOverride?: string;
  variant?: "a" | "b" | null;
};

export function createNotificationService(deps: {
  providers: Partial<Record<NotificationChannel, NotificationProvider>>;
  preferences: NotificationPreferenceRepository;
  suppressions: NotificationSuppressionRepository;
  templates?: NotificationTemplateRepository;
  deliveries: NotificationDeliveryRepository;
  smsConsents: SmsConsentRepository;
  newsletters?: NewsletterRepository;
  enqueue?: EnqueueNotification;
  unsubscribeSecret: string;
  appUrl: string;
  clock?: Clock;
  ids?: IdGenerator;
  rateLimit?: { limit: number; windowMs: number };
}) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const rate = deps.rateLimit ?? { limit: 30, windowMs: 60_000 };

  async function publishedTemplates(key: string, channel: NotificationChannel): Promise<NotificationTemplate[]> {
    const stored = deps.templates ? await deps.templates.listPublished(key, channel) : [];
    return [...stored, ...builtinTemplates()];
  }

  function unsubscribeUrl(channel: NotificationChannel, address: string): string {
    const payload = encodeJson({
      channel,
      address: normalizeAddress(channel, address),
      exp: clock.now().getTime() + 90 * 24 * 60 * 60 * 1000,
    });
    const token = `${payload}.${signPayload(payload, deps.unsubscribeSecret)}`;
    return `${deps.appUrl}/unsubscribe?token=${token}`;
  }

  function parseUnsubscribeToken(token: string): { channel: NotificationChannel; address: string } {
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !safeEqual(signPayload(payload, deps.unsubscribeSecret), signature)) {
      throw new ValidationError("Invalid unsubscribe token");
    }
    const data = decodeJson<{ channel: NotificationChannel; address: string; exp: number }>(payload);
    if (data.exp < clock.now().getTime()) throw new ValidationError("Unsubscribe token expired");
    return { channel: data.channel, address: data.address };
  }

  async function dispatch(input: DispatchInput): Promise<NotificationDelivery> {
    const existing = await deps.deliveries.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    if (input.channel === "whatsapp") {
      const approved = APPROVED_WHATSAPP_TEMPLATES[input.templateKey as WhatsAppTemplateKey];
      if (!approved) throw new ValidationError("WhatsApp messages must use an approved template");
    }

    const to = normalizeAddress(input.channel, input.to);
    const category = templateCategory(input.templateKey);
    const preferences = input.userId ? await deps.preferences.listByUser(input.userId) : [];
    const suppression = await deps.suppressions.find(input.channel, to);
    const smsConsent = input.channel === "sms" ? await deps.smsConsents.findByPhone(to) : null;
    const decision = canSend({
      channel: input.channel,
      category,
      userId: input.userId ?? null,
      preferences,
      suppression,
      smsConsent,
      marketingConsent: input.marketingConsent,
    });

    const now = clock.now();
    if (!decision.allowed) {
      return deps.deliveries.create({
        id: ids.id(),
        userId: input.userId ?? null,
        channel: input.channel,
        category,
        templateKey: input.templateKey,
        to,
        subject: null,
        body: decision.reason ?? "skipped",
        status: "suppressed",
        idempotencyKey: input.idempotencyKey,
        providerMessageId: null,
        variant: input.variant ?? null,
        openedAt: null,
        clickedAt: null,
        trackingEnabled: false,
        createdAt: now,
      });
    }

    const template = latestPublished(
      await publishedTemplates(input.templateKey, input.channel),
      input.templateKey,
      input.channel,
      input.locale,
    );
    if (!template && !input.bodyOverride) {
      throw new NotFoundError("NotificationTemplate", input.templateKey);
    }
    const rendered = template
      ? renderTemplate(template, input.vars ?? {})
      : { subject: input.subjectOverride ?? null, body: input.bodyOverride ?? "" };
    const subject = input.subjectOverride ?? rendered.subject;
    const body = input.bodyOverride ?? rendered.body;
    const trackingEnabled = trackingAllowed(preferences, input.userId ?? null);
    const headers =
      input.channel === "email"
        ? listUnsubscribeHeaders(unsubscribeUrl("email", to))
        : undefined;

    consumeRateLimit({
      key: `notify:${input.channel}`,
      limit: rate.limit,
      windowMs: rate.windowMs,
      now: now.getTime(),
    });

    const provider = deps.providers[input.channel];
    if (!provider) throw new ProviderNotConfiguredError(input.channel);
    if (!provider.isConfigured()) throw new ProviderNotConfiguredError(input.channel);

    try {
      const result = await provider.send({
        channel: input.channel,
        to,
        subject: subject ?? undefined,
        body,
        templateKey: input.templateKey,
        locale: input.locale,
        headers,
        idempotencyKey: input.idempotencyKey,
      });
      return deps.deliveries.create({
        id: ids.id(),
        userId: input.userId ?? null,
        channel: input.channel,
        category,
        templateKey: input.templateKey,
        to,
        subject,
        body,
        status: "sent",
        idempotencyKey: input.idempotencyKey,
        providerMessageId: result.providerMessageId,
        variant: input.variant ?? null,
        openedAt: null,
        clickedAt: null,
        trackingEnabled,
        createdAt: now,
      });
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) throw error;
      throw error instanceof Error ? new ProviderFailed(input.channel, error.message) : new ProviderFailed(input.channel);
    }
  }

  async function enqueue(input: DispatchInput & { availableAt?: Date; jobType?: JobType }) {
    if (!deps.enqueue) return dispatch(input);
    await deps.enqueue({
      type: input.jobType ?? jobTypeFor(input.channel),
      payload: { ...input },
      idempotencyKey: input.idempotencyKey,
      availableAt: input.availableAt,
    });
  }

  async function setPreference(input: {
    userId: string;
    channel: NotificationChannel;
    category: NotificationCategory;
    enabled: boolean;
    trackingConsent?: boolean;
  }): Promise<NotificationPreference> {
    const existing = (await deps.preferences.listByUser(input.userId)).find(
      (item) => item.channel === input.channel && item.category === input.category,
    );
    return deps.preferences.upsert({
      id: existing?.id ?? ids.id(),
      userId: input.userId,
      channel: input.channel,
      category: input.category,
      enabled: input.enabled,
      trackingConsent: input.trackingConsent ?? existing?.trackingConsent ?? false,
      updatedAt: clock.now(),
    });
  }

  async function suppress(channel: NotificationChannel, address: string, reason: SuppressionReason) {
    const normalized = normalizeAddress(channel, address);
    const existing = await deps.suppressions.find(channel, normalized);
    if (existing) return existing;
    return deps.suppressions.create({
      id: ids.id(),
      channel,
      address: normalized,
      reason,
      createdAt: clock.now(),
    });
  }

  async function unsubscribe(token: string) {
    const parsed = parseUnsubscribeToken(token);
    await suppress(parsed.channel, parsed.address, "unsubscribe");
    if (parsed.channel === "sms") {
      await optOutSms(parsed.address, "unsubscribe_link");
    }
    return parsed;
  }

  async function handleBounce(address: string) {
    return suppress("email", address, "bounce");
  }

  async function handleComplaint(address: string) {
    return suppress("email", address, "complaint");
  }

  async function handleSmsInbound(phone: string, body: string) {
    if (!isStopKeyword(body)) return { optedOut: false };
    await optOutSms(phone, "stop");
    await suppress("sms", phone, "stop");
    return { optedOut: true };
  }

  async function optInSms(input: { phone: string; userId?: string | null; source: string }) {
    const phone = normalizeAddress("sms", input.phone);
    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
      throw new ValidationError("A valid E.164 phone number is required");
    }
    const existing = await deps.smsConsents.findByPhone(phone);
    const now = clock.now();
    return deps.smsConsents.upsert({
      id: existing?.id ?? ids.id(),
      userId: input.userId ?? existing?.userId ?? null,
      phone,
      status: "opted_in",
      source: input.source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async function optOutSms(phone: string, source: string) {
    const normalized = normalizeAddress("sms", phone);
    const existing = await deps.smsConsents.findByPhone(normalized);
    const now = clock.now();
    return deps.smsConsents.upsert({
      id: existing?.id ?? ids.id(),
      userId: existing?.userId ?? null,
      phone: normalized,
      status: "opted_out",
      source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async function scheduleEventReminders(input: {
    eventId: string;
    eventTitle: string;
    startsAt: Date;
    timezone: string;
    recipients: Array<{ userId?: string | null; email?: string; phone?: string }>;
  }) {
    const slots = reminderSchedule(input.startsAt, input.timezone);
    for (const recipient of input.recipients) {
      for (const slot of slots) {
        if (recipient.email) {
          await enqueue({
            userId: recipient.userId,
            channel: "email",
            to: recipient.email,
            templateKey: slot.key,
            vars: {
              eventTitle: input.eventTitle,
              startsAt: formatInTimezone(input.startsAt, input.timezone),
              timezone: input.timezone,
            },
            idempotencyKey: `${slot.key}:${input.eventId}:${recipient.email}`,
            availableAt: slot.sendAt,
          });
        }
        if (recipient.phone) {
          await enqueue({
            userId: recipient.userId,
            channel: "sms",
            to: recipient.phone,
            templateKey: slot.key,
            vars: { timezone: input.timezone },
            idempotencyKey: `${slot.key}:sms:${input.eventId}:${recipient.phone}`,
            availableAt: slot.sendAt,
          });
        }
      }
    }
    return slots;
  }

  async function saveNewsletter(input: {
    id?: string;
    organizationId: string;
    calendarId: string;
    subjectA: string;
    subjectB?: string | null;
    blocks: NewsletterBlock[];
  }): Promise<Newsletter> {
    if (!deps.newsletters) throw new ConflictError("Newsletters are unavailable");
    if (!input.subjectA.trim()) throw new ValidationError("A subject is required");
    const now = clock.now();
    if (input.id) {
      const existing = await deps.newsletters.findById(input.id);
      if (!existing) throw new NotFoundError("Newsletter", input.id);
      return deps.newsletters.save({
        ...existing,
        subjectA: input.subjectA.trim(),
        subjectB: input.subjectB?.trim() || null,
        blocks: input.blocks,
        updatedAt: now,
      });
    }
    return deps.newsletters.create({
      id: ids.id(),
      organizationId: input.organizationId,
      calendarId: input.calendarId,
      subjectA: input.subjectA.trim(),
      subjectB: input.subjectB?.trim() || null,
      blocks: input.blocks,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  }

  function previewNewsletter(
    newsletter: Newsletter,
    viewport: "desktop" | "mobile",
    events: Map<string, { title: string; href: string }>,
  ) {
    return {
      subjectA: newsletter.subjectA,
      subjectB: newsletter.subjectB,
      html: renderNewsletterHtml(newsletter.blocks, events),
      viewport,
    };
  }

  async function sendNewsletter(input: {
    newsletter: Newsletter;
    recipients: Array<{ email: string; userId?: string | null }>;
    events?: Map<string, { title: string; href: string }>;
  }) {
    const html = renderNewsletterHtml(input.newsletter.blocks, input.events ?? new Map());
    for (const recipient of input.recipients) {
      const picked = pickAbSubject(input.newsletter, recipient.email);
      await dispatch({
        userId: recipient.userId,
        channel: "email",
        to: recipient.email,
        templateKey: "newsletter",
        bodyOverride: html,
        subjectOverride: picked.subject,
        variant: picked.variant,
        marketingConsent: true,
        idempotencyKey: `newsletter:${input.newsletter.id}:${recipient.email}`,
      });
    }
    if (deps.newsletters) {
      await deps.newsletters.save({ ...input.newsletter, status: "sent", updatedAt: clock.now() });
    }
  }

  async function recordOpen(idempotencyKey: string) {
    const delivery = await deps.deliveries.findByIdempotencyKey(idempotencyKey);
    if (!delivery || !delivery.trackingEnabled || delivery.openedAt) return delivery;
    return deps.deliveries.save({ ...delivery, openedAt: clock.now() });
  }

  async function recordClick(idempotencyKey: string) {
    const delivery = await deps.deliveries.findByIdempotencyKey(idempotencyKey);
    if (!delivery || !delivery.trackingEnabled || delivery.clickedAt) return delivery;
    return deps.deliveries.save({ ...delivery, clickedAt: clock.now() });
  }

  return {
    dispatch,
    enqueue,
    setPreference,
    unsubscribe,
    unsubscribeUrl,
    parseUnsubscribeToken,
    handleBounce,
    handleComplaint,
    handleSmsInbound,
    optInSms,
    optOutSms,
    scheduleEventReminders,
    saveNewsletter,
    previewNewsletter,
    sendNewsletter,
    recordOpen,
    recordClick,
    listPreferences: (userId: string) => deps.preferences.listByUser(userId),
    listNewsletters: (calendarId: string) => deps.newsletters?.listByCalendar(calendarId) ?? Promise.resolve([]),
    getNewsletter: (id: string) => deps.newsletters?.findById(id) ?? Promise.resolve(null),
  };
}

function jobTypeFor(channel: NotificationChannel): JobType {
  if (channel === "sms") return "sms.send";
  if (channel === "whatsapp") return "whatsapp.send";
  if (channel === "web_push") return "web_push.send";
  if (channel === "mobile_push") return "mobile_push.send";
  return "email.send";
}
