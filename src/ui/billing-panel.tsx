"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BillingQuote, PlanId } from "@/domain/billing/types";
import { formatMoney } from "@/domain/payments/currencies";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";

type CatalogPlan = {
  id: PlanId;
  name: string;
  priceMonthlyCents: number | "custom" | "unspecified";
  purchasable: boolean;
};

export function BillingPanel({
  organizationId,
  currentPlanId,
  pendingPlanId,
  cancelAtPeriodEnd,
  catalog,
  labels,
}: {
  organizationId: string;
  currentPlanId: PlanId;
  pendingPlanId: PlanId | null;
  cancelAtPeriodEnd: boolean;
  catalog: CatalogPlan[];
  labels: {
    quote: string;
    price: string;
    taxes: string;
    platformFees: string;
    addOns: string;
    total: string;
    upgrade: string;
    downgrade: string;
    cancel: string;
    cancelConfirm: string;
    cancelHint: string;
    custom: string;
    unspecified: string;
  };
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [cancelToken, setCancelToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function parse(response: Response) {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(apiMessage(payload, t.errors.requestFailed));
    }
    return payload.data;
  }

  async function loadQuote(planId: PlanId) {
    setError(null);
    setPending(true);
    try {
      const data = await parse(
        await fetch(`/api/v1/organizations/${organizationId}/billing?action=quote`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planId }),
        }),
      );
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.unableToQuote);
    } finally {
      setPending(false);
    }
  }

  async function checkout() {
    if (!quote) return;
    setError(null);
    setPending(true);
    try {
      const data = await parse(
        await fetch(`/api/v1/organizations/${organizationId}/billing?action=checkout`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planId: quote.toPlanId, addOns: quote.addOns.map((item) => ({ id: item.id, quantity: item.quantity })) }),
        }),
      );
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setQuote(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.unableToCheckout);
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    setError(null);
    setPending(true);
    try {
      const data = await parse(
        await fetch(`/api/v1/organizations/${organizationId}/billing?action=cancel`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      );
      setCancelToken(data.confirmationToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.unableToCancel);
    } finally {
      setPending(false);
    }
  }

  async function confirmCancel() {
    if (!cancelToken) return;
    setError(null);
    setPending(true);
    try {
      await parse(
        await fetch(`/api/v1/organizations/${organizationId}/billing?action=cancel-confirm`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: cancelToken }),
        }),
      );
      setCancelToken(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.unableToConfirmCancel);
    } finally {
      setPending(false);
    }
  }

  function priceLabel(plan: CatalogPlan) {
    if (plan.priceMonthlyCents === "custom") return labels.custom;
    if (plan.priceMonthlyCents === "unspecified") return labels.unspecified;
    return formatMoney(plan.priceMonthlyCents, "USD", locale);
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-3">
        {catalog.map((plan) => (
          <li key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8E8E8] p-4">
            <div>
              <p className="font-medium">
                {plan.name}
                {plan.id === currentPlanId ? ` · ${t.common.planCurrent}` : ""}
                {pendingPlanId === plan.id ? ` · ${t.common.planScheduled}` : ""}
              </p>
              <p className="text-sm text-zinc-600">{priceLabel(plan)}</p>
            </div>
            {plan.purchasable && plan.id !== currentPlanId ? (
              <Button type="button" variant="secondary" disabled={pending} onClick={() => loadQuote(plan.id)}>
                {labels.quote}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {quote ? (
        <div className="rounded-xl border border-[#E8E8E8] p-4">
          <h3 className="mb-3 text-lg font-semibold">{labels.quote}</h3>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>{labels.price}</dt>
              <dd>{formatMoney(quote.priceCents, quote.currency, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{labels.addOns}</dt>
              <dd>{formatMoney(quote.addOnCents, quote.currency, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{labels.taxes}</dt>
              <dd>{formatMoney(quote.taxCents, quote.currency, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{labels.platformFees}</dt>
              <dd>{formatMoney(quote.platformFeeCents, quote.currency, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4 font-medium">
              <dt>{labels.total}</dt>
              <dd>{formatMoney(quote.totalCents, quote.currency, locale)}</dd>
            </div>
          </dl>
          <Button className="mt-4" type="button" disabled={pending} onClick={checkout}>
            {quote.change === "downgrade" ? labels.downgrade : labels.upgrade}
          </Button>
        </div>
      ) : null}

      {currentPlanId !== "free" && !cancelAtPeriodEnd ? (
        <div className="rounded-xl border border-[#E8E8E8] p-4">
          <p className="mb-3 text-sm text-zinc-600">{labels.cancelHint}</p>
          {cancelToken ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={confirmCancel}>
              {labels.cancelConfirm}
            </Button>
          ) : (
            <Button type="button" variant="secondary" disabled={pending} onClick={cancel}>
              {labels.cancel}
            </Button>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
