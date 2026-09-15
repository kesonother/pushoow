import type { FunctionalLevel } from "@/domain/organization/types";
import type { PublicApiPlan } from "@/domain/public-api/types";
import type { AnalyticsPlan } from "@/domain/analytics/types";
import type { BillingAddOn, Entitlements, Plan, PlanId, PublicPlanId } from "@/domain/billing/types";
import { DEFAULT_PLATFORM_FEE_BPS } from "@/domain/payments/fees";

/**
 * Official commercial grid, validated 2026-09-14.
 * Inspired by Luma (Free + one self-serve paid plan + Enterprise),
 * not Module 12 (Starter/Pro/Business) and not a silent pick between the two specs.
 *
 * starter / pro / business remain as non-listed aliases so existing records resolve.
 */
export const PRICING_GRID_DECISION = {
  status: "validated" as const,
  officialPlanIds: ["free", "plus", "enterprise"] as const,
  inspiredBy: "https://luma.com/pricing",
  reason:
    "Luma sells Free, Plus, and Enterprise — not a five-tier ladder. Pushoow adopts that model: Plus is the only self-serve paid plan, priced under Luma, with calendar quotas kept as the calendar-first differentiator.",
  pricesUsdMonthly: {
    free: 0,
    plus: 49,
    enterprise: "custom",
  } as const,
  retiredSkus: ["starter", "pro", "business"] as const,
  historicalGrids: {
    "module-12": {
      planIds: ["free", "starter", "pro", "business", "enterprise"],
      pricesUsdMonthly: { free: 0, starter: 19, pro: 49, business: 129, enterprise: "custom" },
    },
    "functional-levels": {
      planIds: ["free", "pro", "plus", "enterprise"],
      calendarQuotas: { free: 3, pro: 10, plus: 25, enterprise: 50 },
    },
  },
  defaultPlanId: "free" as const,
};

export const UNLIMITED = -1;

export const BILLING_CYCLE = "monthly" as const;

export const GRACE_PERIOD_DAYS = 7;

export const REFUND_WINDOW_DAYS = 30;

export const RENEWAL_NOTICE_DAYS = [14, 7] as const;

/** Subscription checkout is selling the platform itself — no extra SaaS fee. */
export const SAAS_PLATFORM_FEE_BPS = 0;

export const SAAS_CURRENCY = "USD" as const;

export const PLUS_PRICE_MONTHLY_CENTS = 4900;

function entitlements(partial: Entitlements): Entitlements {
  return partial;
}

const FREE_ENTITLEMENTS = entitlements({
  maxCalendars: 3,
  maxRegistrantsPerEvent: UNLIMITED,
  emailSendsPerMonth: 2_000,
  smsSendsPerMonth: 100,
  whatsappSendsPerMonth: 50,
  apiEnabled: false,
  apiRequestsPerMinute: 0,
  ssoEnabled: false,
  customDomainEnabled: false,
  maxAdmins: 3,
  supportSlaHours: 72,
  advancedAnalytics: false,
  ticketingPlatformFeeBps: DEFAULT_PLATFORM_FEE_BPS,
  aiEnabled: true,
});

const PLUS_ENTITLEMENTS = entitlements({
  maxCalendars: 25,
  maxRegistrantsPerEvent: UNLIMITED,
  emailSendsPerMonth: 20_000,
  smsSendsPerMonth: 500,
  whatsappSendsPerMonth: 250,
  apiEnabled: true,
  apiRequestsPerMinute: 120,
  ssoEnabled: false,
  customDomainEnabled: true,
  maxAdmins: 5,
  supportSlaHours: 12,
  advancedAnalytics: true,
  ticketingPlatformFeeBps: 0,
  aiEnabled: true,
});

const ENTERPRISE_ENTITLEMENTS = entitlements({
  maxCalendars: 50,
  maxRegistrantsPerEvent: UNLIMITED,
  emailSendsPerMonth: UNLIMITED,
  smsSendsPerMonth: UNLIMITED,
  whatsappSendsPerMonth: UNLIMITED,
  apiEnabled: true,
  apiRequestsPerMinute: 10_000,
  ssoEnabled: true,
  customDomainEnabled: true,
  maxAdmins: UNLIMITED,
  supportSlaHours: 4,
  advancedAnalytics: true,
  ticketingPlatformFeeBps: 0,
  aiEnabled: true,
});

function legacyAlias(id: Extract<PlanId, "starter" | "pro" | "business">, name: string): Plan {
  return {
    id,
    name,
    grids: ["official"],
    priceMonthlyCents: PLUS_PRICE_MONTHLY_CENTS,
    priceSource: "legacy",
    listed: false,
    purchasable: false,
    aliasOf: "plus",
    rank: 1,
    entitlements: PLUS_ENTITLEMENTS,
  };
}

export const PLAN_CATALOG: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    grids: ["official"],
    priceMonthlyCents: 0,
    priceSource: "official",
    listed: true,
    purchasable: true,
    rank: 0,
    entitlements: FREE_ENTITLEMENTS,
  },
  plus: {
    id: "plus",
    name: "Plus",
    grids: ["official"],
    priceMonthlyCents: PLUS_PRICE_MONTHLY_CENTS,
    priceSource: "official",
    listed: true,
    purchasable: true,
    rank: 1,
    entitlements: PLUS_ENTITLEMENTS,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    grids: ["official"],
    priceMonthlyCents: "custom",
    priceSource: "official",
    listed: true,
    purchasable: false,
    rank: 2,
    entitlements: ENTERPRISE_ENTITLEMENTS,
  },
  starter: legacyAlias("starter", "Starter"),
  pro: legacyAlias("pro", "Pro"),
  business: legacyAlias("business", "Business"),
};

export const ADD_ON_CATALOG: Record<string, BillingAddOn> = {
  extra_calendars: {
    id: "extra_calendars",
    name: "Extra calendars",
    unitPriceMonthlyCents: 500,
    entitlement: "maxCalendars",
    unitSize: 1,
  },
  extra_email_sends: {
    id: "extra_email_sends",
    name: "Extra email sends",
    unitPriceMonthlyCents: 5000,
    entitlement: "emailSendsPerMonth",
    unitSize: 10_000,
  },
  extra_sms_sends: {
    id: "extra_sms_sends",
    name: "Extra SMS sends",
    unitPriceMonthlyCents: 800,
    entitlement: "smsSendsPerMonth",
    unitSize: 100,
  },
  extra_admins: {
    id: "extra_admins",
    name: "Extra admin seats",
    unitPriceMonthlyCents: 1200,
    entitlement: "maxAdmins",
    unitSize: 1,
  },
};

export function getPlan(planId: string): Plan {
  const plan = PLAN_CATALOG[planId as PlanId];
  if (!plan) {
    throw new Error(`Unknown plan '${planId}'`);
  }
  return plan;
}

export function listCatalogPlans(): Plan[] {
  return (Object.keys(PLAN_CATALOG) as PlanId[]).map((id) => PLAN_CATALOG[id]);
}

export function listPublicPlans(): Plan[] {
  return listCatalogPlans().filter((plan) => plan.listed);
}

export function isPublicPlanId(planId: string): planId is PublicPlanId {
  return (PRICING_GRID_DECISION.officialPlanIds as readonly string[]).includes(planId);
}

export function monthlyPriceCents(plan: Plan): number | null {
  return typeof plan.priceMonthlyCents === "number" ? plan.priceMonthlyCents : null;
}

export function entitlementsFor(planId: PlanId, addOnQuantities?: Record<string, number>): Entitlements {
  const base = { ...getPlan(planId).entitlements };
  if (!addOnQuantities) return base;
  for (const [addOnId, quantity] of Object.entries(addOnQuantities)) {
    if (!quantity) continue;
    const addOn = ADD_ON_CATALOG[addOnId];
    if (!addOn) continue;
    const current = base[addOn.entitlement];
    if (typeof current === "number" && current !== UNLIMITED) {
      (base as Record<string, number | boolean>)[addOn.entitlement] = current + quantity * addOn.unitSize;
    }
  }
  return base;
}

export function functionalLevelFromPlan(planId: PlanId): FunctionalLevel {
  if (planId === "enterprise") return "enterprise";
  if (planId === "free") return "free";
  return "plus";
}

export function analyticsPlanFromEntitlements(planId: PlanId, entitlements: Entitlements): AnalyticsPlan {
  if (!entitlements.advancedAnalytics) return "free";
  if (planId === "enterprise") return "plus";
  return "plus";
}

export function publicApiPlanFromEntitlements(planId: PlanId, entitlements: Entitlements): PublicApiPlan {
  if (!entitlements.apiEnabled) return "free";
  if (planId === "enterprise") return "enterprise";
  return "plus";
}

export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED;
}

export function remainingQuota(used: number, limit: number): number {
  if (isUnlimited(limit)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, limit - used);
}

export function assertWithinLimit(used: number, increment: number, limit: number): boolean {
  if (isUnlimited(limit)) return true;
  return used + increment <= limit;
}
