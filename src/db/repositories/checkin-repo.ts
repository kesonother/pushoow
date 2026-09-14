import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { checkInCapacityAlert, checkInPass, checkInRecord } from "@/db/schema/checkin";
import type {
  CapacityAlertRepository,
  CheckInPassRepository,
  CheckInRecordRepository,
} from "@/domain/checkin/types";

export function createDrizzleCheckInPassRepository(db: Database): CheckInPassRepository {
  return {
    async create(pass) {
      const [row] = await db.insert(checkInPass).values(pass).returning();
      return row;
    },
    async findById(id) {
      const [row] = await db.select().from(checkInPass).where(eq(checkInPass.id, id)).limit(1);
      return row ?? null;
    },
    async findByRegistration(registrationId) {
      const [row] = await db
        .select()
        .from(checkInPass)
        .where(and(eq(checkInPass.registrationId, registrationId)))
        .limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(checkInPass).where(eq(checkInPass.eventId, eventId));
    },
    async save(pass) {
      const [row] = await db.update(checkInPass).set(pass).where(eq(checkInPass.id, pass.id)).returning();
      return row;
    },
  };
}

export function createDrizzleCheckInRecordRepository(db: Database): CheckInRecordRepository {
  return {
    async create(item) {
      const [row] = await db.insert(checkInRecord).values(item).returning();
      return row;
    },
    async findByClientOpId(clientOpId) {
      const [row] = await db
        .select()
        .from(checkInRecord)
        .where(eq(checkInRecord.clientOpId, clientOpId))
        .limit(1);
      return row ?? null;
    },
    async findByRegistration(eventId, registrationId) {
      const [row] = await db
        .select()
        .from(checkInRecord)
        .where(and(eq(checkInRecord.eventId, eventId), eq(checkInRecord.registrationId, registrationId)))
        .limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(checkInRecord).where(eq(checkInRecord.eventId, eventId));
    },
    async countByEvent(eventId) {
      const rows = await db.select().from(checkInRecord).where(eq(checkInRecord.eventId, eventId));
      return rows.length;
    },
  };
}

export function createDrizzleCapacityAlertRepository(db: Database): CapacityAlertRepository {
  return {
    async find(eventId, threshold) {
      const [row] = await db
        .select()
        .from(checkInCapacityAlert)
        .where(and(eq(checkInCapacityAlert.eventId, eventId), eq(checkInCapacityAlert.threshold, threshold)))
        .limit(1);
      return row as Awaited<ReturnType<CapacityAlertRepository["find"]>>;
    },
    async create(item) {
      const [row] = await db.insert(checkInCapacityAlert).values(item).returning();
      return row as Awaited<ReturnType<CapacityAlertRepository["create"]>>;
    },
  };
}
