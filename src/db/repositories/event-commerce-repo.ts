import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { event } from "@/db/schema/events";
import {
  eventAddOn,
  eventContent,
  eventCoupon,
  eventOccurrenceOverride,
  eventOrder,
  eventOrderItem,
  eventRecurrenceRule,
  eventRegistration,
  eventTicketType,
} from "@/db/schema";
import type {
  AddOnRepository,
  CouponRepository,
  EventContentRepository,
  EventRegistrationRepository,
  OrderRepository,
  TicketTypeRepository,
} from "@/domain/event/commerce-types";
import type {
  OccurrenceOverrideRepository,
  RecurrenceRuleRepository,
} from "@/domain/event/recurrence";

const ACTIVE_REGISTRATION = ["pending", "confirmed", "offered", "checked_in"] as const;

export function createDrizzleTicketRepository(db: Database): TicketTypeRepository {
  return {
    async create(ticket) {
      const [row] = await db.insert(eventTicketType).values(ticket).returning();
      return row;
    },
    async findById(id) {
      const [row] = await db.select().from(eventTicketType).where(eq(eventTicketType.id, id)).limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(eventTicketType).where(eq(eventTicketType.eventId, eventId));
    },
    async listAll() {
      return db.select().from(eventTicketType);
    },
    async save(ticket) {
      const [row] = await db
        .update(eventTicketType)
        .set(ticket)
        .where(eq(eventTicketType.id, ticket.id))
        .returning();
      return row;
    },
  };
}

export function createDrizzleCouponRepository(db: Database): CouponRepository {
  return {
    async create(coupon) {
      const [row] = await db.insert(eventCoupon).values(coupon).returning();
      return row;
    },
    async findById(id) {
      const [row] = await db.select().from(eventCoupon).where(eq(eventCoupon.id, id)).limit(1);
      return row ?? null;
    },
    async findByCode(code) {
      const [row] = await db
        .select()
        .from(eventCoupon)
        .where(eq(eventCoupon.code, code.toUpperCase()))
        .limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(eventCoupon).where(eq(eventCoupon.eventId, eventId));
    },
    async save(coupon) {
      const [row] = await db.update(eventCoupon).set(coupon).where(eq(eventCoupon.id, coupon.id)).returning();
      return row;
    },
  };
}

export function createDrizzleAddOnRepository(db: Database): AddOnRepository {
  return {
    async create(addOn) {
      const [row] = await db.insert(eventAddOn).values(addOn).returning();
      return row;
    },
    async findById(id) {
      const [row] = await db.select().from(eventAddOn).where(eq(eventAddOn.id, id)).limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(eventAddOn).where(eq(eventAddOn.eventId, eventId));
    },
    async save(addOn) {
      const [row] = await db.update(eventAddOn).set(addOn).where(eq(eventAddOn.id, addOn.id)).returning();
      return row;
    },
  };
}

export function createDrizzleOrderRepository(db: Database): OrderRepository {
  return {
    async create(order, items) {
      const [row] = await db.insert(eventOrder).values(order).returning();
      if (items.length > 0) await db.insert(eventOrderItem).values(items);
      return row;
    },
    async findById(id) {
      const [row] = await db.select().from(eventOrder).where(eq(eventOrder.id, id)).limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(eventOrder).where(eq(eventOrder.eventId, eventId));
    },
    async listItems(orderId) {
      return db.select().from(eventOrderItem).where(eq(eventOrderItem.orderId, orderId));
    },
    async save(order) {
      const [row] = await db.update(eventOrder).set(order).where(eq(eventOrder.id, order.id)).returning();
      return row;
    },
  };
}

export function createDrizzleRegistrationRepository(db: Database): EventRegistrationRepository {
  return {
    async create(registration) {
      const [row] = await db.insert(eventRegistration).values(registration).returning();
      return row;
    },
    async createIfCapacity(registration, capacity, quantity) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select ${event.id} from ${event} where ${event.id} = ${registration.eventId} for update`);
        const rows = await tx
          .select()
          .from(eventRegistration)
          .where(
            and(
              eq(eventRegistration.eventId, registration.eventId),
              inArray(eventRegistration.status, [...ACTIVE_REGISTRATION]),
            ),
          );
        const taken = rows.reduce((sum, row) => sum + row.quantity, 0);
        if (capacity != null && taken + quantity > capacity) {
          return { ok: false as const, taken };
        }
        const [row] = await tx.insert(eventRegistration).values(registration).returning();
        return { ok: true as const, registration: row };
      });
    },
    async findById(id) {
      const [row] = await db.select().from(eventRegistration).where(eq(eventRegistration.id, id)).limit(1);
      return row ?? null;
    },
    async findByEventAndUser(eventId, userId) {
      const [row] = await db
        .select()
        .from(eventRegistration)
        .where(and(eq(eventRegistration.eventId, eventId), eq(eventRegistration.userId, userId)))
        .limit(1);
      return row ?? null;
    },
    async findByEventAndEmail(eventId, email) {
      const [row] = await db
        .select()
        .from(eventRegistration)
        .where(and(eq(eventRegistration.eventId, eventId), eq(eventRegistration.email, email)))
        .limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(eventRegistration).where(eq(eventRegistration.eventId, eventId));
    },
    async listAll() {
      return db.select().from(eventRegistration);
    },
    async countActive(eventId) {
      const rows = await db
        .select()
        .from(eventRegistration)
        .where(
          and(
            eq(eventRegistration.eventId, eventId),
            inArray(eventRegistration.status, [...ACTIVE_REGISTRATION]),
          ),
        );
      return rows.reduce((sum, row) => sum + row.quantity, 0);
    },
    async save(registration) {
      const [row] = await db
        .update(eventRegistration)
        .set(registration)
        .where(eq(eventRegistration.id, registration.id))
        .returning();
      return row;
    },
  };
}

export function createDrizzleEventContentRepository(db: Database): EventContentRepository {
  return {
    async create(item) {
      const [row] = await db.insert(eventContent).values(item).returning();
      return row;
    },
    async listByEvent(eventId) {
      return db.select().from(eventContent).where(eq(eventContent.eventId, eventId));
    },
    async delete(id) {
      await db.delete(eventContent).where(eq(eventContent.id, id));
    },
  };
}

export function createDrizzleRecurrenceRepository(db: Database): RecurrenceRuleRepository {
  return {
    async save(rule) {
      const existing = await db
        .select()
        .from(eventRecurrenceRule)
        .where(eq(eventRecurrenceRule.eventId, rule.eventId))
        .limit(1);
      if (existing[0]) {
        const [row] = await db
          .update(eventRecurrenceRule)
          .set(rule)
          .where(eq(eventRecurrenceRule.id, existing[0].id))
          .returning();
        return row;
      }
      const [row] = await db.insert(eventRecurrenceRule).values(rule).returning();
      return row;
    },
    async findByEvent(eventId) {
      const [row] = await db
        .select()
        .from(eventRecurrenceRule)
        .where(eq(eventRecurrenceRule.eventId, eventId))
        .limit(1);
      return row ?? null;
    },
  };
}

export function createDrizzleOverrideRepository(db: Database): OccurrenceOverrideRepository {
  return {
    async save(override) {
      const [row] = await db
        .insert(eventOccurrenceOverride)
        .values(override)
        .onConflictDoNothing()
        .returning();
      if (row) return row;
      const [updated] = await db
        .update(eventOccurrenceOverride)
        .set(override)
        .where(eq(eventOccurrenceOverride.id, override.id))
        .returning();
      return updated;
    },
    async findByEventAndOriginal(eventId, originalStartsAt) {
      const [row] = await db
        .select()
        .from(eventOccurrenceOverride)
        .where(
          and(
            eq(eventOccurrenceOverride.eventId, eventId),
            eq(eventOccurrenceOverride.originalStartsAt, originalStartsAt),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(eventOccurrenceOverride).where(eq(eventOccurrenceOverride.eventId, eventId));
    },
  };
}
