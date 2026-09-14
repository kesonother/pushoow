import type {
  CheckoutPayment,
  CheckoutPaymentRepository,
  ConnectedAccount,
  ConnectedAccountRepository,
  IssuedTicket,
  IssuedTicketRepository,
  PaymentRefund,
  PaymentRefundRepository,
  StripeConnectPort,
  StripeWebhookRecord,
  StripeWebhookRepository,
  TaxPort,
  TaxRecord,
  TaxRecordRepository,
} from "@/domain/payments/types";
import { PaymentNotConfiguredError, type PaymentAdapter } from "@/domain/calendar/membership-types";
import { ValidationError } from "@/domain/errors";

export function memoryConnectedAccounts(): ConnectedAccountRepository {
  const items = new Map<string, ConnectedAccount>();
  return {
    async findByOrganization(organizationId) {
      return [...items.values()].find((item) => item.organizationId === organizationId) ?? null;
    },
    async findByStripeAccountId(stripeAccountId) {
      return [...items.values()].find((item) => item.stripeAccountId === stripeAccountId) ?? null;
    },
    async upsert(account) {
      items.set(account.organizationId, account);
      return account;
    },
  };
}

export function memoryCheckoutPayments(): CheckoutPaymentRepository {
  const items = new Map<string, CheckoutPayment>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByOrderId(orderId) {
      return [...items.values()].find((item) => item.orderId === orderId) ?? null;
    },
    async findByCheckoutSessionId(sessionId) {
      return [...items.values()].find((item) => item.stripeCheckoutSessionId === sessionId) ?? null;
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
  };
}

export function memoryPaymentRefunds(): PaymentRefundRepository {
  const items: PaymentRefund[] = [];
  return {
    async create(item) {
      items.push(item);
      return item;
    },
    async listByPayment(paymentId) {
      return items.filter((item) => item.paymentId === paymentId);
    },
    async listByOrganization(organizationId) {
      return items.filter((item) => item.organizationId === organizationId);
    },
  };
}

export function memoryIssuedTickets(): IssuedTicketRepository {
  const items = new Map<string, IssuedTicket>();
  return {
    async createMany(rows) {
      for (const row of rows) items.set(row.id, row);
      return rows;
    },
    async listByOrder(orderId) {
      return [...items.values()].filter((item) => item.orderId === orderId);
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async listByRegistration(registrationId) {
      return [...items.values()].filter((item) => item.registrationId === registrationId);
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByCode(code) {
      return [...items.values()].find((item) => item.code === code) ?? null;
    },
    async save(item) {
      items.set(item.id, item);
      return item;
    },
  };
}

export function memoryStripeWebhooks(): StripeWebhookRepository {
  const items = new Map<string, StripeWebhookRecord>();
  return {
    async findByStripeEventId(stripeEventId) {
      return items.get(stripeEventId) ?? null;
    },
    async create(item) {
      items.set(item.stripeEventId, item);
      return item;
    },
  };
}

export function memoryTaxRecords(): TaxRecordRepository {
  const items: TaxRecord[] = [];
  return {
    async create(item) {
      items.push(item);
      return item;
    },
    async listByOrder(orderId) {
      return items.filter((item) => item.orderId === orderId);
    },
    async listByOrganization(organizationId) {
      return items.filter((item) => item.organizationId === organizationId);
    },
  };
}

export function memoryTaxPort(taxCents = 0): TaxPort {
  return {
    isConfigured: () => taxCents > 0,
    async calculate() {
      return { taxCents, calculationId: taxCents > 0 ? "tax_calc_test" : null };
    },
  };
}

export function recordingStripeConnect(options?: { failCheckout?: boolean; configured?: boolean }): StripeConnectPort &
  PaymentAdapter & {
    checkouts: Array<{ orderId: string; idempotencyKey: string; amountCents: number; currency: string }>;
    refunds: Array<{ paymentIntentId: string; amountCents?: number; idempotencyKey: string }>;
  } {
  const checkouts: Array<{ orderId: string; idempotencyKey: string; amountCents: number; currency: string }> = [];
  const refunds: Array<{ paymentIntentId: string; amountCents?: number; idempotencyKey: string }> = [];
  const sessions = new Map<string, string>();
  return {
    checkouts,
    refunds,
    isConfigured: () => options?.configured ?? true,
    async createExpressAccount() {
      return { stripeAccountId: "acct_test" };
    },
    async createAccountLink() {
      return { url: "https://connect.stripe.com/setup/test" };
    },
    async retrieveAccount() {
      return { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true };
    },
    async createCheckout(input) {
      if (options?.failCheckout) throw new Error("card_declined");
      if (!this.isConfigured()) throw new PaymentNotConfiguredError();
      const orderId =
        "orderId" in input && input.orderId
          ? input.orderId
          : ((input as { membershipId?: string }).membershipId ?? "");
      const idempotencyKey = input.idempotencyKey ?? `checkout:${orderId}`;
      checkouts.push({
        orderId,
        idempotencyKey,
        amountCents: input.amountCents,
        currency: input.currency,
      });
      const existing = [...sessions.entries()].find(([key]) => key === `cs_${idempotencyKey}`);
      const externalId = existing?.[0] ?? `cs_${idempotencyKey}`;
      const checkoutUrl = existing?.[1] ?? `https://checkout.stripe.com/c/pay/${externalId}`;
      sessions.set(externalId, checkoutUrl);
      return { checkoutUrl, externalId, paymentIntentId: `pi_${orderId}` };
    },
    async refund(input) {
      const paymentIntentId =
        "paymentIntentId" in input && input.paymentIntentId
          ? input.paymentIntentId
          : ((input as { externalId?: string }).externalId ?? "");
      refunds.push({
        paymentIntentId,
        amountCents: input.amountCents,
        idempotencyKey: input.idempotencyKey ?? `refund:${paymentIntentId}`,
      });
      return { refundId: `re_${input.idempotencyKey ?? paymentIntentId}` };
    },
    verifyWebhook(payload, signature) {
      if (signature !== "sig_test") throw new ValidationError("Invalid Stripe signature");
      return JSON.parse(payload) as { id: string; type: string; data: Record<string, unknown> };
    },
  };
}
