import type { MobileDevice, MobileDeviceRepository } from "@/domain/mobile/types";

export function createMemoryMobileDevices(): MobileDeviceRepository {
  const items = new Map<string, MobileDevice>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByToken(token) {
      return [...items.values()].find((item) => item.token === token && !item.revokedAt) ?? null;
    },
    async listByUser(userId) {
      return [...items.values()]
        .filter((item) => item.userId === userId && !item.revokedAt)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    },
  };
}
