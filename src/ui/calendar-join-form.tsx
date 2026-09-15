"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";

export function CalendarJoinForm({
  calendarId,
  tiers,
  signedIn,
  loginHref,
  labels,
}: {
  calendarId: string;
  tiers: Array<{ id: string; name: string; kind: string; requiresApproval: boolean }>;
  signedIn: boolean;
  loginHref: string;
  labels: { join: string; login: string; empty: string };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <a
        href={loginHref}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white"
      >
        {labels.login}
      </a>
    );
  }

  if (tiers.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        {labels.empty}{" "}
        <a className="underline" href="/discover">
          {t.emptyState.discoverEvents}
        </a>
      </p>
    );
  }

  async function join(tierId: string) {
    setPending(tierId);
    setError(null);
    const response = await fetch(`/api/v1/calendars/${calendarId}/memberships`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tierId }),
    });
    const payload = await response.json();
    setPending(null);
    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToJoin));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {tiers.map((tier) => (
        <Button
          key={tier.id}
          type="button"
          variant="secondary"
          disabled={pending === tier.id}
          onClick={() => join(tier.id)}
        >
          {labels.join} {tier.name}
        </Button>
      ))}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
