import {
  ADD_ON_CATALOG,
  PRICING_GRID_DECISION,
  SAAS_CURRENCY,
  SAAS_PLATFORM_FEE_BPS,
  getPlan,
  monthlyPriceCents,
} from "@/domain/billing/catalog";
import type { BillingQuote, PlanId } from "@/domain/billing/types";
import { ValidationError } from "@/domain/errors";
import { platformFeeCents } from "@/domain/payments/fees";

export function quoteSubscription(input: {
  organizationId: string;
  billingOrganizationId: string;
  fromPlanId: PlanId;
  toPlanId: PlanId;
  change: BillingQuote["change"];
  addOns?: Array<{ id: string; quantity: number }>;
  taxCents?: number;
  taxConfigured?: boolean;
  prorationCents?: number;
  platformFeeBps?: number;
}): BillingQuote {
  const plan = getPlan(input.toPlanId);
  const listed = monthlyPriceCents(plan);
  if (listed == null) {
    if (plan.priceMonthlyCents === "custom") {
      throw new ValidationError("Enterprise pricing is custom and cannot be purchased self-serve", {
        planId: plan.id,
        pricingGridDecision: PRICING_GRID_DECISION.status,
      });
    }
    throw new ValidationError(
      "This plan has no validated price. The product pricing grid is pending validation.",
      {
        planId: plan.id,
        grids: plan.grids,
        pricingGridDecision: PRICING_GRID_DECISION.status,
      },
    );
  }

  const addOns = (input.addOns ?? []).map((item) => {
    const addOn = ADD_ON_CATALOG[item.id];
    if (!addOn) throw new ValidationError(`Unknown add-on '${item.id}'`);
    if (item.quantity < 1) throw new ValidationError("Add-on quantity must be at least 1");
    return {
      id: addOn.id,
      name: addOn.name,
      quantity: item.quantity,
      unitPriceCents: addOn.unitPriceMonthlyCents,
    };
  });

  const addOnCents = addOns.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const prorationCents = Math.max(0, input.prorationCents ?? listed);
  const priceCents = input.change === "renewal" || input.change === "create" ? listed : prorationCents;
  const merchandiseCents = priceCents + addOnCents;
  const feeBps = input.platformFeeBps ?? SAAS_PLATFORM_FEE_BPS;
  const fee = platformFeeCents(merchandiseCents, feeBps);
  const taxCents = Math.max(0, input.taxCents ?? 0);
  const totalCents = merchandiseCents + taxCents + fee;

  const lines = [
    {
      kind: "plan" as const,
      label: `${plan.name} (monthly)`,
      amountCents: priceCents,
    },
    ...addOns.map((item) => ({
      kind: "addon" as const,
      label: `${item.name} × ${item.quantity}`,
      amountCents: item.unitPriceCents * item.quantity,
    })),
    {
      kind: "tax" as const,
      label: input.taxConfigured ? "Tax" : "Tax (not configured)",
      amountCents: taxCents,
    },
    {
      kind: "platform_fee" as const,
      label: `Platform fee (${(feeBps / 100).toFixed(2)}%)`,
      amountCents: fee,
    },
  ];

  return {
    organizationId: input.organizationId,
    billingOrganizationId: input.billingOrganizationId,
    fromPlanId: input.fromPlanId,
    toPlanId: input.toPlanId,
    change: input.change,
    currency: SAAS_CURRENCY,
    billingCycle: "monthly",
    priceCents,
    addOnCents,
    taxCents,
    platformFeeCents: fee,
    platformFeeBps: feeBps,
    totalCents,
    prorationCents,
    taxConfigured: Boolean(input.taxConfigured),
    pricingGridDecision: PRICING_GRID_DECISION.status,
    priceSource: plan.priceSource,
    addOns,
    lines,
  };
}
