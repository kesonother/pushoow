"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function AgencyClientForm({
  organizationId,
  labels,
}: {
  organizationId: string;
  labels: { createClient: string; name: string; convertAgency: string; isAgency: boolean };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  async function convert() {
    setError(null);
    const response = await fetch(`/api/v1/organizations/${organizationId}/agency/convert`, {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToConvert));
      return;
    }
    router.refresh();
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    const response = await fetch(`/api/v1/organizations/${organizationId}/agency/clients`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: String(formData.get("name") ?? "") }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToCreateClient));
      return;
    }
    router.refresh();
  }

  if (!labels.isAgency) {
    return (
      <div className="flex flex-col gap-3">
        <Button type="button" onClick={convert}>
          {labels.convertAgency}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input name="name" label={labels.name} required minLength={2} />
      </div>
      <Button type="submit">{labels.createClient}</Button>
      {error ? (
        <p role="alert" className="text-sm text-red-700 sm:w-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}
