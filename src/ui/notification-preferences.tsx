"use client";

import { useEffect, useState } from "react";
import { defaultPreferenceEnabled } from "@/domain/notification/policy";
import type { NotificationCategory, NotificationChannel } from "@/domain/notification/types";
import { Button } from "@/ui/button";

const CHANNELS: NotificationChannel[] = ["email", "sms", "whatsapp", "web_push", "mobile_push"];
const CATEGORIES: NotificationCategory[] = [
  "transactional",
  "reminder",
  "event_update",
  "cancellation",
  "new_event",
  "marketing",
];

type Preference = {
  channel: NotificationChannel;
  category: NotificationCategory;
  enabled: boolean;
  trackingConsent: boolean;
};

export function NotificationPreferences({
  labels,
}: {
  labels: {
    title: string;
    save: string;
    tracking: string;
    smsOptIn: string;
    phone: string;
    unavailable: string;
  };
}) {
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [phone, setPhone] = useState("");
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/me/notifications")
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const payload = (await response.json()) as { data: Preference[] };
        setPrefs(payload.data);
        setTracking(payload.data.some((item) => item.trackingConsent));
      })
      .catch(() => setError(labels.unavailable));
  }, [labels.unavailable]);

  function enabled(channel: NotificationChannel, category: NotificationCategory) {
    const match = prefs.find((item) => item.channel === channel && item.category === category);
    return match ? match.enabled : defaultPreferenceEnabled(channel, category);
  }

  async function toggle(channel: NotificationChannel, category: NotificationCategory) {
    const next = !enabled(channel, category);
    const response = await fetch("/api/v1/me/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, category, enabled: next }),
    });
    if (!response.ok) {
      setError(labels.unavailable);
      return;
    }
    const payload = (await response.json()) as { data: Preference };
    setPrefs((current) => {
      const rest = current.filter((item) => !(item.channel === channel && item.category === category));
      return [...rest, payload.data];
    });
  }

  async function persistTracking(next: boolean) {
    const response = await fetch("/api/v1/me/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: "email",
        category: "marketing",
        enabled: enabled("email", "marketing"),
        trackingConsent: next,
      }),
    });
    if (!response.ok) {
      setError(labels.unavailable);
      return;
    }
    const payload = (await response.json()) as { data: Preference };
    setTracking(payload.data.trackingConsent);
    setPrefs((current) => {
      const rest = current.filter((item) => !(item.channel === "email" && item.category === "marketing"));
      return [...rest, payload.data];
    });
  }

  async function optInSms() {
    const response = await fetch("/api/v1/notifications/sms/opt-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!response.ok) setError(labels.unavailable);
  }

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-medium">{labels.title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-start text-sm">
          <thead>
            <tr>
              <th className="pb-2 pe-3"> </th>
              {CHANNELS.map((channel) => (
                <th key={channel} className="pb-2 pe-3 font-medium">
                  {channel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((category) => (
              <tr key={category}>
                <th className="py-2 pe-3 font-medium">{category}</th>
                {CHANNELS.map((channel) => (
                  <td key={`${channel}-${category}`} className="py-2 pe-3">
                    <input
                      type="checkbox"
                      checked={enabled(channel, category)}
                      onChange={() => toggle(channel, category)}
                      aria-label={`${channel} ${category}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={tracking}
          onChange={() => persistTracking(!tracking)}
        />
        {labels.tracking}
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {labels.phone}
        <input
          className="min-h-11 rounded-lg border border-zinc-300 px-3"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+33612345678"
        />
      </label>
      <Button type="button" variant="secondary" onClick={optInSms}>
        {labels.smsOptIn}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
