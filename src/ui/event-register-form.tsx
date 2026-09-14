"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/domain/payments/currencies";
import type { PaymentQuote } from "@/domain/payments/quote";
import { Button } from "@/ui/button";
import { CaptchaFields, useCaptchaChallenge } from "@/ui/captcha-fields";
import { Input } from "@/ui/input";

export function EventRegisterForm({
  eventId,
  registrationMode,
  tickets,
  addOns,
  labels,
}: {
  eventId: string;
  registrationMode?: string;
  tickets?: Array<{ id: string; name: string; priceCents: number; currency: string }>;
  addOns?: Array<{ id: string; name: string; priceCents: number; currency: string }>;
  labels: {
    email: string;
    submit: string;
    success: string;
    password?: string;
    token?: string;
    coupon?: string;
    quantity?: string;
    anonymous?: string;
    appearOnRoster?: string;
    captcha?: string;
    addOns?: string;
    ticketSubtotal?: string;
    tax?: string;
    platformFee?: string;
    total?: string;
    quoteHint?: string;
  };
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [ticketTypeId, setTicketTypeId] = useState(tickets?.[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const paid = (tickets ?? []).some((ticket) => ticket.priceCents > 0);
  const captcha = useCaptchaChallenge();
  const quoteBody = useMemo(
    () => ({
      items: ticketTypeId ? [{ ticketTypeId, quantity }] : [],
      addOnIds: selectedAddOns,
      couponCode: couponCode || undefined,
    }),
    [ticketTypeId, quantity, selectedAddOns, couponCode],
  );

  useEffect(() => {
    if (!quoteBody.items.length) return;
    let cancelled = false;
    fetch(`/api/v1/events/${eventId}/quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(quoteBody),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!cancelled && response.ok) setQuote(payload.data as PaymentQuote);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, quoteBody]);

  async function onSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "");
    const body: Record<string, unknown> = {
      email,
      password: String(formData.get("password") ?? "") || undefined,
      token: String(formData.get("token") ?? "") || undefined,
      couponCode: couponCode || undefined,
      anonymous: formData.get("anonymous") === "on",
      appearOnRoster: formData.get("appearOnRoster") === "on",
      captchaId: String(formData.get("captchaId") ?? "") || undefined,
      captchaAnswer: String(formData.get("captchaAnswer") ?? "") || undefined,
      addOnIds: selectedAddOns,
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
            <select
              name="ticketTypeId"
              className="min-h-11 rounded-lg border border-zinc-300 px-3"
              value={ticketTypeId}
              onChange={(event) => setTicketTypeId(event.target.value)}
            >
              {tickets.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  {ticket.name} · {formatMoney(ticket.priceCents, ticket.currency)}
                </option>
              ))}
            </select>
          </label>
          <Input
            name="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value) || 1)}
            label={labels.quantity ?? "Quantity"}
          />
          {paid && labels.coupon ? (
            <Input
              name="couponCode"
              label={labels.coupon}
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
            />
          ) : null}
        </>
      ) : null}
      {addOns && addOns.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{labels.addOns ?? "Add-ons"}</legend>
          {addOns.map((addOn) => (
            <label key={addOn.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedAddOns.includes(addOn.id)}
                onChange={(event) => {
                  setSelectedAddOns((current) =>
                    event.target.checked
                      ? [...current, addOn.id]
                      : current.filter((id) => id !== addOn.id),
                  );
                }}
              />
              {addOn.name} · {formatMoney(addOn.priceCents, addOn.currency)}
            </label>
          ))}
        </fieldset>
      ) : null}
      {quote ? (
        <aside className="grid gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm" aria-live="polite">
          <p className="font-medium">{labels.quoteHint ?? "Price breakdown — no hidden fees"}</p>
          {quote.lines.map((line) => (
            <p key={`${line.kind}-${line.label}`} className="flex justify-between gap-4">
              <span>{line.label}</span>
              <span>{formatMoney(line.amountCents, quote.currency)}</span>
            </p>
          ))}
          <p className="mt-1 flex justify-between gap-4 font-semibold">
            <span>{labels.total ?? "Total"}</span>
            <span>{formatMoney(quote.totalCents, quote.currency)}</span>
          </p>
        </aside>
      ) : null}
      {labels.anonymous ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="anonymous" />
          {labels.anonymous}
        </label>
      ) : null}
      {labels.appearOnRoster ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="appearOnRoster" />
          {labels.appearOnRoster}
        </label>
      ) : null}
      <CaptchaFields challenge={captcha} label={labels.captcha ?? "CAPTCHA"} />
      <Button type="submit">{labels.submit}</Button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-zinc-700">{labels.success}</p> : null}
    </form>
  );
}
