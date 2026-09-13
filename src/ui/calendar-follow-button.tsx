"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui/button";

export function CalendarFollowButton({
  calendarId,
  following,
  signedIn,
  loginHref,
  labels,
}: {
  calendarId: string;
  following: boolean;
  signedIn: boolean;
  loginHref: string;
  labels: { follow: string; unfollow: string; login: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <a
        href={loginHref}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
      >
        {labels.login}
      </a>
    );
  }

  async function toggle() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/v1/calendars/${calendarId}/follow`, {
      method: following ? "DELETE" : "POST",
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error?.message ?? "Unable to update follow");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant={following ? "secondary" : "primary"} disabled={pending} onClick={toggle}>
        {following ? labels.unfollow : labels.follow}
      </Button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
