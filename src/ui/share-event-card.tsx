"use client";

import { useState } from "react";
import { Button } from "@/ui/button";

export function ShareEventCard({
  path,
  title,
  copyLabel,
  copiedLabel,
}: {
  path: string;
  title: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    await fetch("/api/v1/onboarding/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "share" }),
    });
  }

  return (
    <div className="rounded-xl border border-[#E8E8E8] p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 break-all text-sm text-zinc-600">{path}</p>
      <Button type="button" className="mt-3" variant="secondary" onClick={() => void copy()}>
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  );
}
