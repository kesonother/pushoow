import type { DpaMetadata } from "@/domain/privacy/types";

export const PLATFORM_DPA: DpaMetadata = {
  organizationId: null,
  version: "1",
  purposes: ["account", "event_registration", "notifications", "security", "legal_compliance"],
  legalBases: ["contract", "consent", "legitimate_interest", "legal_obligation"],
  subprocessors: [],
  dataSaleAllowed: false,
};

export const CCPA_DISCLOSURE = {
  sellsPersonalInformation: false,
  categoriesCollected: [
    "account_email",
    "profile",
    "event_registrations",
    "notification_preferences",
    "security_signals",
  ],
  purposes: PLATFORM_DPA.purposes,
};

export function defaultCcpaSettings(userId: string, at: Date) {
  return {
    userId,
    saleOptOut: true,
    disclosureAcknowledged: false,
    updatedAt: at,
  };
}
