import { entitlementsFor, remainingQuota } from "@/domain/billing/catalog";
import type { EntitlementKey, Entitlements, PlanId, ResolvedEntitlements } from "@/domain/billing/types";
import { ForbiddenError, ValidationError } from "@/domain/errors";

export function resolveEntitlements(
  planId: PlanId,
  addOnQuantities?: Record<string, number>,
): ResolvedEntitlements {
  return {
    planId,
    source: "subscription",
    ...entitlementsFor(planId, addOnQuantities),
  };
}

export function entitlementValue<K extends EntitlementKey>(
  entitlements: Entitlements,
  key: K,
): Entitlements[K] {
  return entitlements[key];
}

export function assertFeature(entitlements: Entitlements, key: Extract<EntitlementKey, `${string}Enabled`>) {
  if (!entitlements[key]) {
    throw new ForbiddenError(`This feature is not included in the current plan`);
  }
}

export function assertQuota(input: {
  used: number;
  increment?: number;
  limit: number;
  metric: string;
}) {
  const increment = input.increment ?? 1;
  const remaining = remainingQuota(input.used, input.limit);
  if (remaining < increment) {
    throw new ValidationError(`${input.metric} limit reached for this organization`, {
      used: input.used,
      limit: input.limit,
      metric: input.metric,
    });
  }
}

export type EntitlementResolver = {
  forOrganization: (organizationId: string) => Promise<ResolvedEntitlements>;
};
