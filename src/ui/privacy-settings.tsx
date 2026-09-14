"use client";

import { useState } from "react";
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
  };
}) {
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <section className="grid gap-3">
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
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
