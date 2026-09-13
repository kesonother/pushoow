"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function CalendarNewsletterForm({
  calendarId,
  labels,
}: {
  calendarId: string;
  labels: { title: string; email: string; submit: string; success: string };
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSuccess(false);
    const response = await fetch(`/api/v1/calendars/${calendarId}/subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: String(formData.get("email") ?? "") }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to subscribe");
      return;
    }
    setSuccess(true);
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">{labels.title}</h2>
      <Input name="email" type="email" label={labels.email} required />
      <Button type="submit" disabled={pending}>
        {labels.submit}
      </Button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-zinc-700">{labels.success}</p> : null}
    </form>
  );
}
