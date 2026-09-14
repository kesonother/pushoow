export const PLAN_IDS = ["free", "starter", "pro", "plus", "business", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PUBLIC_PLAN_IDS = ["free", "plus", "enterprise"] as const;
export type PublicPlanId = (typeof PUBLIC_PLAN_IDS)[number];

export const PRICING_GRID_IDS = ["official", "module-12", "functional-levels"] as const;
export type PricingGridId = (typeof PRICING_GRID_IDS)[number];

export const BILLING_CYCLES = ["monthly"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "grace",
  "canceled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INVOICE_STATUSES = [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
  "refunded",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const CANCELLATION_STATUSES = ["pending_confirmation", "confirmed"] as const;
export type CancellationStatus = (typeof CANCELLATION_STATUSES)[number];

export const USAGE_METRICS = [
  "calendars",
  "registrants",
  "email_sends",
  "sms_sends",
  "whatsapp_sends",
  "api_requests",
  "admins",
] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

export const SUBSCRIPTION_ITEM_KINDS = ["plan", "addon"] as const;
export type SubscriptionItemKind = (typeof SUBSCRIPTION_ITEM_KINDS)[number];

export type Entitlements = {
  maxCalendars: number;
  maxRegistrantsPerEvent: number;
  emailSendsPerMonth: number;
  smsSendsPerMonth: number;
  whatsappSendsPerMonth: number;
  apiEnabled: boolean;
  apiRequestsPerMinute: number;
  ssoEnabled: boolean;
  customDomainEnabled: boolean;
  maxAdmins: number;
  supportSlaHours: number;
  advancedAnalytics: boolean;
  ticketingPlatformFeeBps: number;
};

export type EntitlementKey = keyof Entitlements;

export type PlanPrice = number | "custom" | "unspecified";

export type Plan = {
  id: PlanId;
  name: string;
  grids: PricingGridId[];
  priceMonthlyCents: PlanPrice;
  priceSource: "official" | "legacy";
  listed: boolean;
  purchasable: boolean;
  aliasOf?: PublicPlanId;
  rank: number;
  entitlements: Entitlements;
};

export type BillingAddOn = {
  id: string;
  name: string;
  unitPriceMonthlyCents: number;
  entitlement: Extract<EntitlementKey, "maxCalendars" | "emailSendsPerMonth" | "smsSendsPerMonth" | "maxAdmins">;
  unitSize: number;
};

export type ResolvedEntitlements = Entitlements & {
  planId: PlanId;
  source: "subscription";
};

export type Subscription = {
  id: string;
  organizationId: string;
  billingOrganizationId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  pendingPlanId: PlanId | null;
  graceEndsAt: Date | null;
  renewalNotice14SentAt: Date | null;
  renewalNotice7SentAt: Date | null;
  checkoutSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionItem = {
  id: string;
  organizationId: string;
  subscriptionId: string;
  kind: SubscriptionItemKind;
  planId: PlanId | null;
  addOnId: string | null;
  quantity: number;
  unitPriceCents: number;
  createdAt: Date;
};

export type PaymentMethodRef = {
  id: string;
  organizationId: string;
  billingOrganizationId: string;
  provider: "stripe";
  externalId: string;
  brand: string | null;
  last4: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BillingQuoteLine = {
  kind: "plan" | "addon" | "tax" | "platform_fee";
  label: string;
  amountCents: number;
};

export type BillingQuote = {
  organizationId: string;
  billingOrganizationId: string;
  fromPlanId: PlanId;
  toPlanId: PlanId;
  change: "create" | "upgrade" | "downgrade" | "renewal" | "none";
  currency: "USD";
  billingCycle: BillingCycle;
  priceCents: number;
  addOnCents: number;
  taxCents: number;
  platformFeeCents: number;
  platformFeeBps: number;
  totalCents: number;
  prorationCents: number;
  taxConfigured: boolean;
  pricingGridDecision: "validated" | "pending_product_validation";
  priceSource: Plan["priceSource"];
  addOns: Array<{ id: string; name: string; quantity: number; unitPriceCents: number }>;
  lines: BillingQuoteLine[];
};

export type Invoice = {
  id: string;
  organizationId: string;
  billingOrganizationId: string;
  subscriptionId: string;
  number: string;
  status: InvoiceStatus;
  currency: "USD";
  priceCents: number;
  addOnCents: number;
  taxCents: number;
  platformFeeCents: number;
  processorFeeCents: number;
  totalCents: number;
  quote: BillingQuote;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paymentMethodId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  refundedCents: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Usage = {
  id: string;
  organizationId: string;
  metric: UsageMetric;
  periodStart: Date;
  periodEnd: Date;
  quantity: number;
};

export type Cancellation = {
  id: string;
  organizationId: string;
  subscriptionId: string;
  status: CancellationStatus;
  confirmationToken: string;
  requestedAt: Date;
  confirmedAt: Date | null;
  emailSentAt: Date | null;
};

export type SubscriptionRepository = {
  create: (item: Subscription) => Promise<Subscription>;
  save: (item: Subscription) => Promise<Subscription>;
  findById: (id: string) => Promise<Subscription | null>;
  findCurrentByOrganization: (organizationId: string) => Promise<Subscription | null>;
  findByCheckoutSessionId: (sessionId: string) => Promise<Subscription | null>;
  listDueForRenewal: (now: Date) => Promise<Subscription[]>;
  listForRenewalNotice: (now: Date) => Promise<Subscription[]>;
  listInGrace: (now: Date) => Promise<Subscription[]>;
};

export type SubscriptionItemRepository = {
  create: (item: SubscriptionItem) => Promise<SubscriptionItem>;
  listBySubscription: (subscriptionId: string) => Promise<SubscriptionItem[]>;
  replaceForSubscription: (subscriptionId: string, items: SubscriptionItem[]) => Promise<SubscriptionItem[]>;
};

export type InvoiceRepository = {
  create: (item: Invoice) => Promise<Invoice>;
  save: (item: Invoice) => Promise<Invoice>;
  findById: (id: string) => Promise<Invoice | null>;
  findByCheckoutSessionId: (sessionId: string) => Promise<Invoice | null>;
  findByPaymentIntentId: (paymentIntentId: string) => Promise<Invoice | null>;
  listByOrganization: (organizationId: string) => Promise<Invoice[]>;
  listByBillingOrganization: (billingOrganizationId: string) => Promise<Invoice[]>;
};

export type UsageRepository = {
  increment: (input: {
    id: string;
    organizationId: string;
    metric: UsageMetric;
    periodStart: Date;
    periodEnd: Date;
    quantity: number;
  }) => Promise<Usage>;
  find: (organizationId: string, metric: UsageMetric, periodStart: Date) => Promise<Usage | null>;
  listByOrganization: (organizationId: string, periodStart: Date) => Promise<Usage[]>;
};

export type PaymentMethodRepository = {
  create: (item: PaymentMethodRef) => Promise<PaymentMethodRef>;
  save: (item: PaymentMethodRef) => Promise<PaymentMethodRef>;
  findById: (id: string) => Promise<PaymentMethodRef | null>;
  findDefaultByBillingOrganization: (billingOrganizationId: string) => Promise<PaymentMethodRef | null>;
};

export type CancellationRepository = {
  create: (item: Cancellation) => Promise<Cancellation>;
  save: (item: Cancellation) => Promise<Cancellation>;
  findById: (id: string) => Promise<Cancellation | null>;
  findPendingBySubscription: (subscriptionId: string) => Promise<Cancellation | null>;
};

export type BillingCharger = {
  charge: (input: {
    invoiceId: string;
    organizationId: string;
    amountCents: number;
    currency: string;
    paymentMethodId?: string | null;
  }) => Promise<{
    ok: boolean;
    processorFeeCents: number;
    paymentIntentId?: string | null;
    paymentMethodId?: string | null;
  }>;
  refund: (input: {
    paymentIntentId?: string | null;
    amountCents: number;
  }) => Promise<{ refundId: string }>;
};

export type BillingNotifier = {
  notify: (input: {
    organizationId: string;
    templateKey: string;
    subject: string;
    body: string;
    idempotencyKey: string;
  }) => Promise<void>;
};
