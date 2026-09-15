"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";

export function ResendVerificationButton({ label }: { label: string }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<string | null>(null);

  async function resend() {
    const response = await fetch("/api/v1/auth/verify-email", { method: "POST" });
    setStatus(response.ok ? "sent" : "error");
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={resend}>
        {label}
      </Button>
      {status === "sent" ? <p role="status">{t.errors.verificationSent}</p> : null}
      {status === "error" ? (
        <p role="alert" className="text-sm text-red-700">
          {t.errors.unableToVerify}
        </p>
      ) : null}
    </div>
  );
}
