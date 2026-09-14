import type { PaymentQuote } from "@/domain/payments/quote";

export const KYC_STATUSES = ["pending", "restricted", "verified"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const PAYOUT_STATUSES = ["pending", "active", "disabled"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ISSUED_TICKET_STATUSES = ["valid", "refunded", "void"] as const;
export type IssuedTicketStatus = (typeof ISSUED_TICKET_STATUSES)[number];

export type ConnectedAccount = {
  id: string;
  organizationId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  kycStatus: KycStatus;
  payoutStatus: PayoutStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CheckoutPayment = {
  id: string;
  organizationId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  checkoutUrl: string | null;
  applicationFeeCents: number;
  taxCents: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentRefund = {
  id: string;
  organizationId: string;
  paymentId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  reason: string;
  kind: "individual" | "partial" | "full";
  stripeRefundId: string | null;
  createdAt: Date;
};

export type IssuedTicket = {
  id: string;
  organizationId: string;
  eventId: string;
  orderId: string;
  registrationId: string | null;
  ticketTypeId: string | null;
  code: string;
  status: IssuedTicketStatus;
  createdAt: Date;
};

export type StripeWebhookRecord = {
  id: string;
  stripeEventId: string;
  type: string;
  processedAt: Date;
};

export type TaxRecord = {
  id: string;
  organizationId: string;
  orderId: string;
  currency: string;
  taxCents: number;
  exemptionCode: string | null;
  stripeCalculationId: string | null;
  createdAt: Date;
};

export type ConnectedAccountRepository = {
  findByOrganization: (organizationId: string) => Promise<ConnectedAccount | null>;
  findByStripeAccountId: (stripeAccountId: string) => Promise<ConnectedAccount | null>;
  upsert: (account: ConnectedAccount) => Promise<ConnectedAccount>;
};

export type CheckoutPaymentRepository = {
  create: (item: CheckoutPayment) => Promise<CheckoutPayment>;
  findById: (id: string) => Promise<CheckoutPayment | null>;
  findByOrderId: (orderId: string) => Promise<CheckoutPayment | null>;
  findByCheckoutSessionId: (sessionId: string) => Promise<CheckoutPayment | null>;
  listByOrganization: (organizationId: string) => Promise<CheckoutPayment[]>;
  save: (item: CheckoutPayment) => Promise<CheckoutPayment>;
};

export type PaymentRefundRepository = {
  create: (item: PaymentRefund) => Promise<PaymentRefund>;
  listByPayment: (paymentId: string) => Promise<PaymentRefund[]>;
  listByOrganization: (organizationId: string) => Promise<PaymentRefund[]>;
};

export type IssuedTicketRepository = {
  createMany: (items: IssuedTicket[]) => Promise<IssuedTicket[]>;
  listByOrder: (orderId: string) => Promise<IssuedTicket[]>;
  listByEvent?: (eventId: string) => Promise<IssuedTicket[]>;
  listByRegistration?: (registrationId: string) => Promise<IssuedTicket[]>;
  findById: (id: string) => Promise<IssuedTicket | null>;
  findByCode?: (code: string) => Promise<IssuedTicket | null>;
  save: (item: IssuedTicket) => Promise<IssuedTicket>;
};

export type StripeWebhookRepository = {
  findByStripeEventId: (stripeEventId: string) => Promise<StripeWebhookRecord | null>;
  create: (item: StripeWebhookRecord) => Promise<StripeWebhookRecord>;
};

export type TaxRecordRepository = {
  create: (item: TaxRecord) => Promise<TaxRecord>;
  listByOrder: (orderId: string) => Promise<TaxRecord[]>;
  listByOrganization: (organizationId: string) => Promise<TaxRecord[]>;
};

export type TaxAddress = {
  country: string;
  postalCode?: string;
  line1?: string;
  city?: string;
};

export type TaxPort = {
  isConfigured: () => boolean;
  calculate: (input: {
    currency: string;
    amountCents: number;
    exemptionCode?: string | null;
    address?: TaxAddress | null;
  }) => Promise<{ taxCents: number; calculationId: string | null }>;
};

export type StripeConnectPort = {
  isConfigured: () => boolean;
  createExpressAccount: (input: {
    organizationId: string;
    email?: string;
  }) => Promise<{ stripeAccountId: string }>;
  createAccountLink: (input: {
    stripeAccountId: string;
    refreshUrl: string;
    returnUrl: string;
  }) => Promise<{ url: string }>;
  retrieveAccount: (stripeAccountId: string) => Promise<{
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }>;
  createCheckout: (input: {
    orderId?: string;
    membershipId?: string;
    amountCents: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
    connectedAccountId?: string;
    applicationFeeCents?: number;
    idempotencyKey?: string;
    require3ds?: boolean;
    automaticTax?: boolean;
    lineItems?: Array<{ name: string; quantity: number; unitAmountCents: number }>;
  }) => Promise<{ checkoutUrl: string; externalId: string; paymentIntentId?: string | null }>;
  refund: (input: {
    paymentIntentId?: string;
    externalId?: string;
    amountCents?: number;
    reason?: string;
    idempotencyKey?: string;
  }) => Promise<{ refundId: string }>;
  verifyWebhook: (payload: string, signature: string) => { id: string; type: string; data: Record<string, unknown> };
};

export type CheckoutResult = {
  orderId: string;
  checkoutUrl: string | null;
  quote: PaymentQuote;
  paymentId: string | null;
  alreadyPaid: boolean;
};
