"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/domain/support/types";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function SupportTicketActions({
  organizationId,
  ticketId,
  canManage,
  labels,
}: {
  organizationId: string;
  ticketId: string;
  canManage: boolean;
  labels: {
    reply: string;
    internal: string;
    assign: string;
    status: string;
    priority: string;
    message: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function post(action: string, body: Record<string, unknown>) {
    setError(null);
    const response = await fetch(
      `/api/v1/organizations/${organizationId}/support/tickets/${ticketId}?action=${action}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to update ticket");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        action={async (formData) => {
          await post("reply", {
            body: String(formData.get("body") ?? ""),
            visibility: formData.get("internal") === "on" ? "internal" : "public",
          });
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900">
          {labels.message}
          <textarea
            name="body"
            required
            rows={4}
            className="min-h-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-950 outline-none focus-visible:border-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-950/20"
          />
        </label>
        {canManage ? (
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="internal" />
            {labels.internal}
          </label>
        ) : null}
        <Button type="submit">{labels.reply}</Button>
      </form>

      {canManage ? (
        <>
          <form
            action={async (formData) => {
              await post("assign", { assigneeUserId: String(formData.get("assigneeUserId") ?? "") });
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Input name="assigneeUserId" label={labels.assign} required />
            <Button type="submit" variant="secondary">
              {labels.assign}
            </Button>
          </form>
          <form
            action={async (formData) => {
              await post("status", { status: String(formData.get("status") ?? "") });
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900">
              {labels.status}
              <select name="status" className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3">
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              {labels.status}
            </Button>
          </form>
          <form
            action={async (formData) => {
              await post("priority", { priority: String(formData.get("priority") ?? "") });
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900">
              {labels.priority}
              <select name="priority" className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3">
                {TICKET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              {labels.priority}
            </Button>
          </form>
        </>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
