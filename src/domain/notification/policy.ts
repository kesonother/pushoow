import {
  isMarketingCategory,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreference,
  type NotificationSuppression,
  type SmsConsent,
} from "@/domain/notification/types";

export function defaultPreferenceEnabled(
  channel: NotificationChannel,
  category: NotificationCategory,
): boolean {
  if (channel === "email") {
    return category !== "marketing";
  }
  return false;
}

export function preferenceEnabled(
  preferences: NotificationPreference[],
  userId: string | null,
  channel: NotificationChannel,
  category: NotificationCategory,
): boolean {
  if (!userId) {
    return defaultPreferenceEnabled(channel, category);
  }
  const match = preferences.find((item) => item.userId === userId && item.channel === channel && item.category === category);
  return match ? match.enabled : defaultPreferenceEnabled(channel, category);
}

export function trackingAllowed(
  preferences: NotificationPreference[],
  userId: string | null,
): boolean {
  if (!userId) return false;
  return preferences.some((item) => item.userId === userId && item.trackingConsent);
}

export function canSend(input: {
  channel: NotificationChannel;
  category: NotificationCategory;
  userId: string | null;
  preferences: NotificationPreference[];
  suppression: NotificationSuppression | null;
  smsConsent?: SmsConsent | null;
  marketingConsent?: boolean;
}): { allowed: boolean; reason: string | null } {
  if (input.suppression) {
    return { allowed: false, reason: `suppressed:${input.suppression.reason}` };
  }

  if (input.channel === "sms") {
    if (!input.smsConsent || input.smsConsent.status !== "opted_in") {
      return { allowed: false, reason: "sms_opt_in_required" };
    }
  }

  if (input.channel === "whatsapp" && isMarketingCategory(input.category)) {
    if (!preferenceEnabled(input.preferences, input.userId, "whatsapp", input.category)) {
      return { allowed: false, reason: "preference_disabled" };
    }
  }

  if (isMarketingCategory(input.category)) {
    if (input.marketingConsent === false) {
      return { allowed: false, reason: "marketing_opt_out" };
    }
    if (!preferenceEnabled(input.preferences, input.userId, input.channel, input.category)) {
      return { allowed: false, reason: "preference_disabled" };
    }
  } else if (input.userId) {
    if (!preferenceEnabled(input.preferences, input.userId, input.channel, input.category)) {
      return { allowed: false, reason: "preference_disabled" };
    }
  }

  return { allowed: true, reason: null };
}

export function isStopKeyword(body: string): boolean {
  return /^\s*(stop|stopall|unsubscribe|annuler|arrêt|arret)\s*$/i.test(body.trim());
}
