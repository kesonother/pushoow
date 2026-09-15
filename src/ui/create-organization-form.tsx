"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function CreateOrganizationForm({
  labels,
}: {
  labels: { create: string; name: string };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: String(formData.get("name") ?? "") }),
    });
    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToCreateOrganization));
      return;
    }

    router.push(`/dashboard/organizations/${payload.data.id}/calendars?template=meetup`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input name="name" label={labels.name} required minLength={2} />
      </div>
      <Button type="submit" disabled={pending}>
        {labels.create}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-700 sm:w-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}
