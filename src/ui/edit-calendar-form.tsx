"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function EditCalendarForm({
  calendar,
  labels,
}: {
  calendar: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    timezone: string;
    defaultCurrency: string;
    visibility: string;
    contactEmail: string | null;
    postalAddress: string | null;
    primaryColor: string | null;
    socialLink: string | null;
    bannedWords?: string[];
  };
  labels: {
    name: string;
    description: string;
    timezone: string;
    currency: string;
    visibility: string;
    save: string;
    delete: string;
    bannedWords?: string;
  };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/v1/calendars/${calendar.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        description: String(formData.get("description") ?? "") || null,
        timezone: String(formData.get("timezone") ?? ""),
        defaultCurrency: String(formData.get("defaultCurrency") ?? ""),
        visibility: String(formData.get("visibility") ?? ""),
        contactEmail: String(formData.get("contactEmail") ?? "") || null,
        postalAddress: String(formData.get("postalAddress") ?? "") || null,
        primaryColor: String(formData.get("primaryColor") ?? "") || null,
        socialLink: String(formData.get("socialLink") ?? "") || null,
        bannedWords: String(formData.get("bannedWords") ?? "")
          .split(",")
          .map((word) => word.trim())
          .filter(Boolean),
      }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToUpdateCalendar));
      return;
    }
    router.refresh();
  }

  async function onDelete() {
    if (!window.confirm(labels.delete)) return;
    setPending(true);
    const response = await fetch(`/api/v1/calendars/${calendar.id}`, { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json();
      setError(apiMessage(payload, t.errors.unableToDeleteCalendar));
      return;
    }
    router.push("/dashboard");
  }

  return (
    <form action={onSubmit} className="grid gap-4">
      <Input name="name" label={labels.name} defaultValue={calendar.name} required />
      <Input name="slug" label={t.calendar.slug} defaultValue={calendar.slug} required />
      <Input name="description" label={labels.description} defaultValue={calendar.description ?? ""} />
      <Input name="timezone" label={labels.timezone} defaultValue={calendar.timezone} />
      <Input name="defaultCurrency" label={labels.currency} defaultValue={calendar.defaultCurrency} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900">
        {labels.visibility}
        <select
          name="visibility"
          defaultValue={calendar.visibility}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3"
        >
          <option value="public">{t.common.visibilityPublic}</option>
          <option value="unlisted">{t.common.visibilityUnlisted}</option>
          <option value="private">{t.common.visibilityPrivate}</option>
        </select>
      </label>
      <Input name="contactEmail" type="email" label={t.calendar.contactEmail} defaultValue={calendar.contactEmail ?? ""} />
      <Input name="postalAddress" label={t.calendar.postalAddress} defaultValue={calendar.postalAddress ?? ""} />
      <Input name="primaryColor" label={t.calendar.primaryColor} defaultValue={calendar.primaryColor ?? ""} />
      <Input name="socialLink" label={t.calendar.socialLink} defaultValue={calendar.socialLink ?? ""} />
      <Input
        name="bannedWords"
        label={labels.bannedWords ?? t.event.bannedWords}
        defaultValue={(calendar.bannedWords ?? []).join(", ")}
        hint={t.calendar.bannedWordsHint}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {labels.save}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onDelete}>
          {labels.delete}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
