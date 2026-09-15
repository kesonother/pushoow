"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";

export function InvoiceRefundButton({
  organizationId,
  invoiceId,
  label,
}: {
  organizationId: string;
  invoiceId: string;
  label: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refund() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/billing?action=refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(apiMessage(payload, t.errors.refundFailed));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.refundFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <Button type="button" variant="ghost" disabled={pending} onClick={refund}>
        {label}
      </Button>
      {error ? <span className="text-red-700">{error}</span> : null}
    </span>
  );
}
