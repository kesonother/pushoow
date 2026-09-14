import type {
  Newsletter,
  NewsletterRepository,
  NotificationDelivery,
  NotificationDeliveryRepository,
  NotificationPreference,
  NotificationPreferenceRepository,
  NotificationProvider,
  NotificationSuppression,
  NotificationSuppressionRepository,
  SmsConsent,
  SmsConsentRepository,
} from "@/domain/notification/types";

export function memoryPreferences(): NotificationPreferenceRepository {
  const items = new Map<string, NotificationPreference>();
  return {
    async listByUser(userId) {
      return [...items.values()].filter((item) => item.userId === userId);
    },
    async upsert(preference) {
      items.set(`${preference.userId}:${preference.channel}:${preference.category}`, preference);
      return preference;
    },
  };
}

export function memorySuppressions(): NotificationSuppressionRepository {
  const items = new Map<string, NotificationSuppression>();
  return {
    async find(channel, address) {
      return items.get(`${channel}:${address}`) ?? null;
    },
    async create(item) {
      items.set(`${item.channel}:${item.address}`, item);
      return item;
    },
  };
}

export function memoryDeliveries(): NotificationDeliveryRepository {
  const items = new Map<string, NotificationDelivery>();
  return {
    async findByIdempotencyKey(key) {
      return [...items.values()].find((item) => item.idempotencyKey === key) ?? null;
    },
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async listAll() {
      return [...items.values()];
    },
  };
}

export function memorySmsConsents(): SmsConsentRepository {
  const items = new Map<string, SmsConsent>();
  return {
    async findByPhone(phone) {
      return items.get(phone) ?? null;
    },
    async upsert(item) {
      items.set(item.phone, item);
      return item;
    },
  };
}

export function memoryNewsletters(): NewsletterRepository {
  const items = new Map<string, Newsletter>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByCalendar(calendarId) {
      return [...items.values()].filter((item) => item.calendarId === calendarId);
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
  };
}

export function recordingProvider(
  channel: NotificationProvider["channel"],
  options?: { fail?: boolean; configured?: boolean },
): NotificationProvider & {
  sent: Array<{ to: string; subject?: string; body: string; headers?: Record<string, string> }>;
} {
  const sent: Array<{ to: string; subject?: string; body: string; headers?: Record<string, string> }> = [];
  return {
    channel,
    sent,
    isConfigured: () => options?.configured ?? true,
    async send(message) {
      if (options?.fail) throw new Error("provider down");
      sent.push({ to: message.to, subject: message.subject, body: message.body, headers: message.headers });
      return { providerMessageId: `msg_${sent.length}` };
    },
  };
}
