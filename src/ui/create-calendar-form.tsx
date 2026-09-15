"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function CreateCalendarForm({
  organizationId,
  labels,
  defaultTemplate,
}: {
  organizationId: string;
  labels: { create: string; name: string; meetupTemplate: string };
  defaultTemplate?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/v1/organizations/${organizationId}/calendars`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        templateId: formData.get("template") === "meetup" ? "meetup" : undefined,
      }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToCreateCalendar));
      return;
    }
    const calendarId = payload.data?.id as string | undefined;
    if (calendarId) {
      router.push(
        `/dashboard/organizations/${organizationId}/calendars/${calendarId}/events/new?starter=first_meetup`,
      );
    }
    router.refresh();
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input name="name" label={labels.name} required minLength={2} defaultValue={defaultTemplate ? "Meetup" : ""} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="template" value="meetup" defaultChecked={defaultTemplate} />
        {labels.meetupTemplate}
      </label>
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
