"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui/button";

export function AcceptInvitationForm({
  token,
  title,
  submit,
}: {
  token: string;
  title: string;
  submit: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    const response = await fetch("/api/v1/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error?.message ?? "Unable to accept invitation");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="button" onClick={accept} disabled={!token}>
        {submit}
      </Button>
    </div>
  );
}
