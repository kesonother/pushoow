"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SUPPORT_CHANNELS, TICKET_PRIORITIES } from "@/domain/support/types";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function SupportTicketForm({
  organizationId,
  labels,
}: {
  organizationId: string;
  labels: {
    create: string;
    subject: string;
    message: string;
    priority: string;
    channel: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const response = await fetch(`/api/v1/organizations/${organizationId}/support/tickets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: String(formData.get("subject") ?? ""),
        body: String(formData.get("body") ?? ""),
        priority: String(formData.get("priority") ?? "normal"),
        channel: String(formData.get("channel") ?? "in_app"),
      }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to open ticket");
      return;
    }
    router.push(`/dashboard/organizations/${organizationId}/support/${payload.data.ticket.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <Input name="subject" label={labels.subject} required minLength={3} maxLength={160} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900">
        {labels.message}
        <textarea
          name="body"
          required
          rows={5}
          className="min-h-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-950 outline-none focus-visible:border-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-950/20"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900">
          {labels.priority}
          <select
            name="priority"
            defaultValue="normal"
            className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base font-normal"
          >
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900">
          {labels.channel}
          <select
            name="channel"
            defaultValue="in_app"
            className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base font-normal"
          >
            {SUPPORT_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {labels.create}
      </Button>
    </form>
  );
}
