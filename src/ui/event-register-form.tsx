"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function EventRegisterForm({
  eventId,
  registrationMode,
  tickets,
  labels,
}: {
  eventId: string;
  registrationMode?: string;
  tickets?: Array<{ id: string; name: string; priceCents: number; currency: string }>;
  labels: {
    email: string;
    submit: string;
    success: string;
    password?: string;
    token?: string;
    coupon?: string;
    quantity?: string;
  };
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const paid = (tickets ?? []).some((ticket) => ticket.priceCents > 0);

  async function onSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "");
    const ticketTypeId = String(formData.get("ticketTypeId") ?? "");
    const quantity = Number(formData.get("quantity") ?? 1);
    const body: Record<string, unknown> = {
      email,
      password: String(formData.get("password") ?? "") || undefined,
      token: String(formData.get("token") ?? "") || undefined,
      couponCode: String(formData.get("couponCode") ?? "") || undefined,
    };
    if (ticketTypeId) {
      body.items = [{ ticketTypeId, quantity: Number.isFinite(quantity) ? quantity : 1 }];
    }
    const response = await fetch(`/api/v1/events/${eventId}/registrations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to register");
      return;
    }
    if (payload.data?.checkoutUrl) {
      window.location.href = payload.data.checkoutUrl;
      return;
    }
    setSuccess(true);
  }

  return (
    <form action={onSubmit} className="grid gap-3">
      <Input name="email" type="email" label={labels.email} required />
      {registrationMode === "password" && labels.password ? (
        <Input name="password" type="password" label={labels.password} required />
      ) : null}
      {registrationMode === "token" && labels.token ? (
        <Input name="token" label={labels.token} required />
      ) : null}
      {tickets && tickets.length > 0 ? (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {labels.quantity ?? "Tickets"}
            <select name="ticketTypeId" className="min-h-11 rounded-lg border border-zinc-300 px-3">
              {tickets.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  {ticket.name} · {(ticket.priceCents / 100).toFixed(2)} {ticket.currency}
                </option>
              ))}
            </select>
          </label>
          <Input name="quantity" type="number" min={1} defaultValue="1" label={labels.quantity ?? "Quantity"} />
          {paid && labels.coupon ? <Input name="couponCode" label={labels.coupon} /> : null}
        </>
      ) : null}
      <Button type="submit">{labels.submit}</Button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-zinc-700">{labels.success}</p> : null}
    </form>
  );
}
