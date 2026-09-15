import type {
  ReferralCode,
  ReferralCodeRepository,
  ReferralConversion,
  ReferralConversionRepository,
} from "./types";

export function createMemoryReferralCodes(): ReferralCodeRepository {
  const items = new Map<string, ReferralCode>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async findByCode(code) {
      return [...items.values()].find((item) => item.code === code) ?? null;
    },
    async findOrganizerByUser(userId) {
      return [...items.values()].find((item) => item.kind === "organizer" && item.userId === userId) ?? null;
    },
    async findAttendeeByUserAndEvent(userId, eventId) {
      return (
        [...items.values()].find(
          (item) => item.kind === "attendee" && item.userId === userId && item.eventId === eventId,
        ) ?? null
      );
    },
  };
}

export function createMemoryReferralConversions(): ReferralConversionRepository {
  const items = new Map<string, ReferralConversion>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async listByCode(codeId) {
      return [...items.values()].filter((item) => item.codeId === codeId);
    },
    async listByReferrer(userId) {
      return [...items.values()].filter((item) => item.referrerUserId === userId);
    },
    async findByRefereeAndKind(userId, kind, eventId) {
      return (
        [...items.values()].find((item) => {
          if (item.refereeUserId !== userId || item.kind !== kind) return false;
          if (kind === "attendee") return item.eventId === eventId;
          return true;
        }) ?? null
      );
    },
  };
}
