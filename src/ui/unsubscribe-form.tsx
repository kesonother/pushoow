"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui/button";

export function UnsubscribeForm({
  labels,
}: {
  labels: { submit: string; success: string; unavailable: string };
}) {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  async function submit() {
    if (!token) {
      setStatus("error");
      return;
    }
    const response = await fetch("/api/v1/notifications/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setStatus(response.ok ? "done" : "error");
  }

  return (
    <div className="grid gap-3">
      <Button type="button" onClick={submit}>
        {labels.submit}
      </Button>
      {status === "done" ? <p>{labels.success}</p> : null}
      {status === "error" ? <p role="alert">{labels.unavailable}</p> : null}
    </div>
  );
}
