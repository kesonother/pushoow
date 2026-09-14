import type {
  CapacityAlertRecord,
  CapacityAlertRepository,
  CheckInPass,
  CheckInPassRepository,
  CheckInRecord,
  CheckInRecordRepository,
} from "@/domain/checkin/types";

export function memoryCheckInPasses(): CheckInPassRepository {
  const items = new Map<string, CheckInPass>();
  return {
    async create(pass) {
      if ([...items.values()].some((existing) => existing.registrationId === pass.registrationId)) {
        throw new Error("Check-in pass already exists");
      }
      items.set(pass.id, pass);
      return pass;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByRegistration(registrationId) {
      return [...items.values()].find((item) => item.registrationId === registrationId) ?? null;
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async save(pass) {
      items.set(pass.id, pass);
      return pass;
    },
  };
}

export function memoryCheckInRecords(): CheckInRecordRepository {
  const items = new Map<string, CheckInRecord>();
  return {
    async create(item) {
      const collision = [...items.values()].some(
        (existing) =>
          existing.clientOpId === item.clientOpId ||
          (existing.eventId === item.eventId && existing.registrationId === item.registrationId),
      );
      if (collision) throw new Error("Check-in already recorded");
      items.set(item.id, item);
      return item;
    },
    async findByClientOpId(clientOpId) {
      return [...items.values()].find((item) => item.clientOpId === clientOpId) ?? null;
    },
    async findByRegistration(eventId, registrationId) {
      return (
        [...items.values()].find((item) => item.eventId === eventId && item.registrationId === registrationId) ??
        null
      );
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async countByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId).length;
    },
  };
}

export function memoryCapacityAlerts(): CapacityAlertRepository {
  const items: CapacityAlertRecord[] = [];
  return {
    async find(eventId, threshold) {
      return items.find((item) => item.eventId === eventId && item.threshold === threshold) ?? null;
    },
    async create(item) {
      items.push(item);
      return item;
    },
  };
}
