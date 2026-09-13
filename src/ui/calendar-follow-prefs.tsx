"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CalendarFollowPrefs({
  calendarId,
  preferences,
  labels,
}: {
  calendarId: string;
  preferences: { email: boolean; push: boolean; sms: boolean };
  labels: { email: string; push: string; sms: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function update(key: "email" | "push" | "sms", value: boolean) {
    setError(null);
    const response = await fetch(`/api/v1/calendars/${calendarId}/follow`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error?.message ?? "Unable to update preferences");
      return;
    }
    router.refresh();
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Notifications</legend>
      {(
        [
          ["email", labels.email, preferences.email],
          ["push", labels.push, preferences.push],
          ["sms", labels.sms, preferences.sms],
        ] as const
      ).map(([key, label, checked]) => (
        <label key={key} className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => update(key, event.target.checked)}
          />
          {label}
        </label>
      ))}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </fieldset>
  );
}
