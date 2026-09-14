"use client";

import { useState } from "react";
import type { IntegrationCategory, IntegrationConnectionView } from "@/domain/integration/types";
import { Button } from "@/ui/button";

const CATEGORIES: IntegrationCategory[] = ["crm", "marketing", "productivity", "video", "calendar"];

type Labels = {
  title: string;
  hint: string;
  connect: string;
  disconnect: string;
  sync: string;
  oauth: string;
  connected: string;
  disconnected: string;
  pending: string;
  error: string;
  notConfigured: string;
  crm: string;
  marketing: string;
  productivity: string;
  video: string;
  calendar: string;
};

export function IntegrationsPanel({
  organizationId,
  initialItems,
  labels,
}: {
  organizationId: string;
  initialItems: IntegrationConnectionView[];
  labels: Labels;
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});

  async function load() {
    const response = await fetch(`/api/v1/organizations/${organizationId}/integrations`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load integrations");
    setItems(payload.data);
  }

  async function run(provider: string, action: "connect" | "oauth" | "disconnect" | "sync") {
    setPending(provider);
    setError(null);
    try {
      if (action === "oauth") {
        const response = await fetch(`/api/v1/organizations/${organizationId}/integrations/${provider}/oauth`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? labels.notConfigured);
        const url = String(payload.data.authorizationUrl ?? "");
        if (url) {
          const link = document.createElement("a");
          link.href = url;
          link.rel = "noreferrer";
          link.click();
        }
        return;
      }
      const path = action === "connect" ? "connect" : action === "disconnect" ? "disconnect" : "sync";
      const response = await fetch(`/api/v1/organizations/${organizationId}/integrations/${provider}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: action === "connect" ? JSON.stringify({ credentials: parseCredentials(keys[provider] ?? "") }) : "{}",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Request failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-8">
      <p className="text-sm text-zinc-600">{labels.hint}</p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {CATEGORIES.map((category) => (
        <section key={category} className="grid gap-3">
          <h2 className="text-lg font-medium">{labels[category]}</h2>
          <ul className="grid gap-3">
            {items
              .filter((item) => item.category === category)
              .map((item) => (
                <li key={item.provider} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-zinc-600">
                        {item.status === "connected"
                          ? labels.connected
                          : item.status === "pending"
                            ? labels.pending
                            : item.status === "error"
                              ? labels.error
                              : labels.disconnected}
                        {item.lastError ? ` · ${item.lastError}` : ""}
                        {!item.configured && item.authType !== "api_key" ? ` · ${labels.notConfigured}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.authType !== "api_key" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending === item.provider}
                          onClick={() => void run(item.provider, "oauth")}
                        >
                          {labels.oauth}
                        </Button>
                      ) : null}
                      {item.connected ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={pending === item.provider}
                            onClick={() => void run(item.provider, "sync")}
                          >
                            {labels.sync}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={pending === item.provider}
                            onClick={() => void run(item.provider, "disconnect")}
                          >
                            {labels.disconnect}
                          </Button>
                        </>
                      ) : item.authType !== "oauth" ? (
                        <Button
                          type="button"
                          disabled={pending === item.provider}
                          onClick={() => void run(item.provider, "connect")}
                        >
                          {labels.connect}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {item.authType !== "oauth" && !item.connected ? (
                    <input
                      className="mt-3 min-h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm"
                      placeholder={item.credentialFields.join(", ")}
                      value={keys[item.provider] ?? ""}
                      onChange={(event) =>
                        setKeys((current) => ({ ...current, [item.provider]: event.target.value }))
                      }
                    />
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function parseCredentials(value: string): Record<string, string> {
  const trimmed = value.trim();
  if (trimmed.startsWith("http")) return { webhookUrl: trimmed };
  if (trimmed.includes("=")) {
    return Object.fromEntries(
      trimmed.split(/[,\s]+/).map((part) => {
        const [key, ...rest] = part.split("=");
        return [key ?? "apiKey", rest.join("=")];
      }),
    );
  }
  return { apiKey: trimmed };
}
