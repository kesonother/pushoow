"use client";

import { useState } from "react";
import { PUBLIC_WEBHOOK_EVENTS, type PublicWebhookEventType } from "@/domain/public-api/types";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";

type Labels = {
  title: string;
  hint: string;
  keys: string;
  createKey: string;
  keyName: string;
  tokenOnce: string;
  webhooks: string;
  createWebhook: string;
  url: string;
  events: string;
  deliveries: string;
  retry: string;
  secretOnce: string;
  docs: string;
};

type KeyView = { id: string; name: string; prefix: string; plan: string; createdAt: string | Date };
type WebhookView = { id: string; url: string; events: string[]; active: boolean };
type DeliveryView = { id: string; event: string; status: string; attempts: number; lastError: string | null };

export function DevelopersPanel({
  organizationId,
  initialKeys,
  initialWebhooks,
  labels,
}: {
  organizationId: string;
  initialKeys: KeyView[];
  initialWebhooks: WebhookView[];
  labels: Labels;
}) {
  const { t } = useI18n();
  const [keys, setKeys] = useState(initialKeys);
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [deliveries, setDeliveries] = useState<Record<string, DeliveryView[]>>({});
  const [token, setToken] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch(`/api/v1/organizations/${organizationId}/developers`);
    const payload = await response.json();
    if (!response.ok) throw new Error(apiMessage(payload, t.errors.unableToLoad));
    setKeys(payload.data.keys);
    setWebhooks(payload.data.webhooks);
  }

  async function createKey(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/developers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "key", name: String(formData.get("name") ?? "Default") }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Error");
      setToken(payload.data.token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  async function createWebhook(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const events = PUBLIC_WEBHOOK_EVENTS.filter((event) => formData.get(event) === "on");
      const response = await fetch(`/api/v1/organizations/${organizationId}/developers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "webhook", url: String(formData.get("url") ?? ""), events }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Error");
      setSecret(payload.data.secret);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  async function loadDeliveries(webhookId: string) {
    const response = await fetch(`/api/v1/organizations/${organizationId}/developers/webhooks/${webhookId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Error");
    setDeliveries((current) => ({ ...current, [webhookId]: payload.data }));
  }

  async function retry(webhookId: string, deliveryId?: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/developers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "retry", webhookId, deliveryId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Error");
      await loadDeliveries(webhookId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-zinc-600">{labels.hint}</p>
      <a href="/docs/api" className="inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70">
        {labels.docs}
      </a>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {token ? (
        <p className="rounded-lg bg-zinc-100 p-3 text-sm">
          {labels.tokenOnce}: <code>{token}</code>
        </p>
      ) : null}
      {secret ? (
        <p className="rounded-lg bg-zinc-100 p-3 text-sm">
          {labels.secretOnce}: <code>{secret}</code>
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{labels.keys}</h2>
        <form action={createKey} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-sm">
            {labels.keyName}
            <input name="name" className="mt-1 min-h-11 rounded-lg border border-zinc-300 px-3" defaultValue="Default" />
          </label>
          <Button type="submit" disabled={pending}>
            {labels.createKey}
          </Button>
        </form>
        <ul className="flex flex-col gap-2 text-sm">
          {keys.map((key) => (
            <li key={key.id} className="rounded-lg border border-[#E8E8E8] px-3 py-2">
              {key.name} · {key.prefix}… · {key.plan}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{labels.webhooks}</h2>
        <form action={createWebhook} className="flex flex-col gap-3">
          <label className="flex flex-col text-sm">
            {labels.url}
            <input name="url" type="url" required className="mt-1 min-h-11 rounded-lg border border-zinc-300 px-3" />
          </label>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="text-sm">{labels.events}</legend>
            {PUBLIC_WEBHOOK_EVENTS.map((event: PublicWebhookEventType) => (
              <label key={event} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={event} defaultChecked />
                {event}
              </label>
            ))}
          </fieldset>
          <Button type="submit" disabled={pending}>
            {labels.createWebhook}
          </Button>
        </form>
        <ul className="flex flex-col gap-3">
          {webhooks.map((webhook) => (
            <li key={webhook.id} className="rounded-lg border border-[#E8E8E8] p-3 text-sm">
              <p>{webhook.url}</p>
              <p className="text-zinc-600">{webhook.events.join(", ")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => loadDeliveries(webhook.id)}>
                  {labels.deliveries}
                </Button>
                <Button type="button" variant="ghost" disabled={pending} onClick={() => retry(webhook.id)}>
                  {labels.retry}
                </Button>
              </div>
              {(deliveries[webhook.id] ?? []).map((delivery) => (
                <p key={delivery.id} className="mt-2 text-xs text-zinc-600">
                  {delivery.event} · {delivery.status} · {delivery.attempts} · {delivery.lastError ?? "ok"}
                  {delivery.status !== "delivered" ? (
                    <button type="button" className="ms-2 underline" onClick={() => retry(webhook.id, delivery.id)}>
                      {labels.retry}
                    </button>
                  ) : null}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
