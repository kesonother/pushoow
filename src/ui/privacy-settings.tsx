"use client";

import { useEffect, useState } from "react";
import { Button } from "@/ui/button";

export function PrivacySettings({
  labels,
}: {
  labels: {
    title: string;
    disclosure: string;
    acknowledge: string;
    optOut: string;
    export: string;
    portability: string;
    delete: string;
    unavailable: string;
    aiTitle: string;
    aiDisclosure: string;
    aiOptOut: string;
    aiTrainingConsent: string;
    aiAcknowledge: string;
  };
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [aiOptOut, setAiOptOut] = useState(false);
  const [training, setTraining] = useState(false);

  useEffect(() => {
    fetch("/api/v1/me/ai/privacy")
      .then((response) => response.json())
      .then((payload) => {
        setAiOptOut(Boolean(payload.data?.processingOptOut));
        setTraining(Boolean(payload.data?.trainingConsent));
      })
      .catch(() => undefined);
  }, []);

  async function run(action: string) {
    setMessage(null);
    const response = await fetch("/api/v1/me/privacy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      setMessage(labels.unavailable);
      return;
    }
    setMessage(action);
  }

  async function patchAi(next: { processingOptOut?: boolean; trainingConsent?: boolean; disclosureAcknowledged?: boolean }) {
    setMessage(null);
    const response = await fetch("/api/v1/me/ai/privacy", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!response.ok) {
      setMessage(labels.unavailable);
      return;
    }
    const payload = await response.json();
    setAiOptOut(Boolean(payload.data?.processingOptOut));
    setTraining(Boolean(payload.data?.trainingConsent));
    setMessage("ai");
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-3">
        <h2 className="text-lg font-medium">{labels.title}</h2>
        <p className="text-sm text-zinc-600">{labels.disclosure}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => run("acknowledge")}>
            {labels.acknowledge}
          </Button>
          <Button type="button" variant="secondary" onClick={() => run("opt_out")}>
            {labels.optOut}
          </Button>
          <Button type="button" variant="secondary" onClick={() => run("export")}>
            {labels.export}
          </Button>
          <Button type="button" variant="secondary" onClick={() => run("portability")}>
            {labels.portability}
          </Button>
          <Button type="button" variant="secondary" onClick={() => run("delete")}>
            {labels.delete}
          </Button>
        </div>
      </div>
      <div className="grid gap-3">
        <h3 className="text-base font-medium">{labels.aiTitle}</h3>
        <p className="text-sm text-zinc-600">{labels.aiDisclosure}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={aiOptOut}
            onChange={(event) => patchAi({ processingOptOut: event.target.checked })}
          />
          {labels.aiOptOut}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={training}
            onChange={(event) => patchAi({ trainingConsent: event.target.checked })}
          />
          {labels.aiTrainingConsent}
        </label>
        <Button type="button" variant="secondary" onClick={() => patchAi({ disclosureAcknowledged: true })}>
          {labels.aiAcknowledge}
        </Button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
