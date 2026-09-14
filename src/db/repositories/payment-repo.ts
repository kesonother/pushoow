import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  checkoutPayment,
  issuedTicket,
  paymentRefund,
  stripeConnectedAccount,
  stripeWebhookEvent,
  taxRecord,
} from "@/db/schema/payments";
import type {
  CheckoutPaymentRepository,
  ConnectedAccountRepository,
  IssuedTicketRepository,
  PaymentRefundRepository,
  StripeWebhookRepository,
  TaxRecordRepository,
} from "@/domain/payments/types";

export function createDrizzleConnectedAccountRepository(db: Database): ConnectedAccountRepository {
  return {
    async findByOrganization(organizationId) {
      const [row] = await db
        .select()
        .from(stripeConnectedAccount)
        .where(eq(stripeConnectedAccount.organizationId, organizationId))
        .limit(1);
      return row ?? null;
    },
    async findByStripeAccountId(stripeAccountId) {
      const [row] = await db
        .select()
        .from(stripeConnectedAccount)
        .where(eq(stripeConnectedAccount.stripeAccountId, stripeAccountId))
        .limit(1);
      return row ?? null;
    },
    async upsert(account) {
      const [row] = await db
        .insert(stripeConnectedAccount)
        .values(account)
        .onConflictDoUpdate({
          target: stripeConnectedAccount.organizationId,
          set: {
            stripeAccountId: account.stripeAccountId,
            chargesEnabled: account.chargesEnabled,
            payoutsEnabled: account.payoutsEnabled,
            kycStatus: account.kycStatus,
            payoutStatus: account.payoutStatus,
            updatedAt: account.updatedAt,
          },
        })
        .returning();
      return row;
    },
  };
}

export function createDrizzleCheckoutPaymentRepository(db: Database): CheckoutPaymentRepository {
  return {
    async create(item) {
      const [row] = await db.insert(checkoutPayment).values(item).returning();
      return row;
    },
    async findById(id) {
      const [row] = await db.select().from(checkoutPayment).where(eq(checkoutPayment.id, id)).limit(1);
      return row ?? null;
    },
    async findByOrderId(orderId) {
      const [row] = await db
        .select()
        .from(checkoutPayment)
        .where(eq(checkoutPayment.orderId, orderId))
        .limit(1);
      return row ?? null;
    },
    async findByCheckoutSessionId(sessionId) {
      const [row] = await db
        .select()
        .from(checkoutPayment)
        .where(eq(checkoutPayment.stripeCheckoutSessionId, sessionId))
        .limit(1);
      return row ?? null;
    },
    async listByOrganization(organizationId) {
      return db.select().from(checkoutPayment).where(eq(checkoutPayment.organizationId, organizationId));
    },
    async save(item) {
      const [row] = await db.update(checkoutPayment).set(item).where(eq(checkoutPayment.id, item.id)).returning();
      return row;
    },
  };
}

export function createDrizzlePaymentRefundRepository(db: Database): PaymentRefundRepository {
  return {
    async create(item) {
      const [row] = await db.insert(paymentRefund).values(item).returning();
      return row;
    },
    async listByPayment(paymentId) {
      return db.select().from(paymentRefund).where(eq(paymentRefund.paymentId, paymentId));
    },
    async listByOrganization(organizationId) {
      return db.select().from(paymentRefund).where(eq(paymentRefund.organizationId, organizationId));
    },
  };
}

export function createDrizzleIssuedTicketRepository(db: Database): IssuedTicketRepository {
  return {
    async createMany(items) {
      if (items.length === 0) return [];
      return db.insert(issuedTicket).values(items).returning();
    },
    async listByOrder(orderId) {
      return db.select().from(issuedTicket).where(eq(issuedTicket.orderId, orderId));
    },
    async listByEvent(eventId) {
      return db.select().from(issuedTicket).where(eq(issuedTicket.eventId, eventId));
    },
    async listByRegistration(registrationId) {
      return db.select().from(issuedTicket).where(eq(issuedTicket.registrationId, registrationId));
    },
    async findById(id) {
      const [row] = await db.select().from(issuedTicket).where(eq(issuedTicket.id, id)).limit(1);
      return row ?? null;
    },
    async findByCode(code) {
      const [row] = await db.select().from(issuedTicket).where(eq(issuedTicket.code, code)).limit(1);
      return row ?? null;
    },
    async save(item) {
      const [row] = await db.update(issuedTicket).set(item).where(eq(issuedTicket.id, item.id)).returning();
      return row;
    },
  };
}

export function createDrizzleStripeWebhookRepository(db: Database): StripeWebhookRepository {
  return {
    async findByStripeEventId(stripeEventId) {
      const [row] = await db
        .select()
        .from(stripeWebhookEvent)
        .where(eq(stripeWebhookEvent.stripeEventId, stripeEventId))
        .limit(1);
      return row ?? null;
    },
    async create(item) {
      const [row] = await db.insert(stripeWebhookEvent).values(item).returning();
      return row;
    },
  };
}

export function createDrizzleTaxRecordRepository(db: Database): TaxRecordRepository {
  return {
    async create(item) {
      const [row] = await db.insert(taxRecord).values(item).returning();
      return row;
    },
    async listByOrder(orderId) {
      return db.select().from(taxRecord).where(eq(taxRecord.orderId, orderId));
    },
    async listByOrganization(organizationId) {
      return db.select().from(taxRecord).where(eq(taxRecord.organizationId, organizationId));
    },
  };
}
