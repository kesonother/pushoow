"use client";

import { useState } from "react";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";

export function StripeConnectCard({
  organizationId,
  account,
  labels,
}: {
  organizationId: string;
  account: {
    stripeAccountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    kycStatus: string;
    payoutStatus: string;
  } | null;
  labels: {
    title: string;
    start: string;
    kyc: string;
    payouts: string;
    charges: string;
  };
}) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    const response = await fetch(`/api/v1/organizations/${organizationId}/payments/connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToStartStripe));
      return;
    }
    if (payload.data?.onboardingUrl) {
      window.location.href = payload.data.onboardingUrl as string;
    }
  }

  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      {account ? (
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt>{labels.kyc}</dt>
            <dd>{account.kycStatus}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{labels.payouts}</dt>
            <dd>{account.payoutStatus}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{labels.charges}</dt>
            <dd>{account.chargesEnabled ? "enabled" : "disabled"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-zinc-600">Stripe Connect is not connected yet.</p>
      )}
      <Button type="button" onClick={start}>
        {labels.start}
      </Button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
