import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { mobileDevice } from "@/db/schema/mobile";
import type { MobileDevice, MobileDeviceRepository } from "@/domain/mobile/types";

function mapDevice(row: typeof mobileDevice.$inferSelect): MobileDevice {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform,
    pushProvider: row.pushProvider,
    token: row.token,
    appBundleId: row.appBundleId ?? null,
    widgetInstalled: row.widgetInstalled,
    watchPaired: row.watchPaired,
    lastSnapshotAt: row.lastSnapshotAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    revokedAt: row.revokedAt ?? null,
  };
}

export function createDrizzleMobileDeviceRepository(db: Database): MobileDeviceRepository {
  return {
    async create(item) {
      const [row] = await db.insert(mobileDevice).values(item).returning();
      return mapDevice(row!);
    },
    async save(item) {
      const [row] = await db.update(mobileDevice).set(item).where(eq(mobileDevice.id, item.id)).returning();
      return mapDevice(row!);
    },
    async findById(id) {
      const [row] = await db.select().from(mobileDevice).where(eq(mobileDevice.id, id)).limit(1);
      return row ? mapDevice(row) : null;
    },
    async findByToken(token) {
      const [row] = await db
        .select()
        .from(mobileDevice)
        .where(and(eq(mobileDevice.token, token), isNull(mobileDevice.revokedAt)))
        .limit(1);
      return row ? mapDevice(row) : null;
    },
    async listByUser(userId) {
      const rows = await db
        .select()
        .from(mobileDevice)
        .where(and(eq(mobileDevice.userId, userId), isNull(mobileDevice.revokedAt)))
        .orderBy(desc(mobileDevice.updatedAt));
      return rows.map(mapDevice);
    },
  };
}
