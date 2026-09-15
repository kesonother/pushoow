"use client";

import { useEffect, useState } from "react";
import { Button } from "@/ui/button";

type Snapshot = {
  code: { code: string; kind: string };
  link: string;
  clicks: number;
  attributed: number;
  eligible: number;
  granted: number;
  blocked: number;
};

export function ReferralCard({
  title,
  body,
  copyLabel,
  copiedLabel,
  rewardLabel,
  eventId,
}: {
  title: string;
  body: string;
  copyLabel: string;
  copiedLabel: string;
  rewardLabel: string;
  eventId?: string;
}) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const path = eventId ? `/api/v1/events/${eventId}/referrals` : "/api/v1/referrals";
    void fetch(path)
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { data: Snapshot };
        setData(payload.data);
      })
      .catch(() => undefined);
  }, [eventId]);

  if (!data) return null;
  const snapshot = data;

  async function copy() {
    await navigator.clipboard.writeText(snapshot.link);
    setCopied(true);
  }

  return (
    <section className="rounded-xl border border-[#E8E8E8] bg-white p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600">{body}</p>
      <p className="mt-3 break-all text-sm">{data.link}</p>
      <p className="mt-2 text-sm text-zinc-600">
        {data.code.code} · {data.clicks} · {rewardLabel}: {data.granted}
      </p>
      <Button type="button" className="mt-3" variant="secondary" onClick={() => void copy()}>
        {copied ? copiedLabel : copyLabel}
      </Button>
    </section>
  );
}
