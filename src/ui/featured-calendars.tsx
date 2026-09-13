"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { Card } from "@/ui/card";

type Labels = Dictionary["discover"];

type FeaturedCalendar = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  publishedEventCount: number;
  followerCount: number;
  averageAttendance: number | null;
  buyable: false;
};

export function FeaturedCalendars({ labels }: { labels: Labels }) {
  const [items, setItems] = useState<FeaturedCalendar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/v1/calendars/featured")
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const payload = (await response.json()) as { data: FeaturedCalendar[] };
        setItems(payload.data);
        setError(null);
        setReady(true);
      })
      .catch(() => {
        setError(labels.unavailable);
        setReady(true);
      });
  }, [labels.unavailable]);

  return (
    <div className="grid gap-6">
      <p className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">{labels.notBuyable}</p>
      {error ? <p role="alert">{error}</p> : null}
      {ready && items.length === 0 && !error ? <p>{labels.featuredEmpty}</p> : null}
      <ul className="grid gap-4">
        {items.map((calendar) => (
          <li key={calendar.id}>
            <Card>
              <p className="text-xs uppercase tracking-wide text-zinc-500">{labels.eligibility}</p>
              <Link href={`/c/${calendar.slug}`} className="mt-1 block text-xl font-semibold underline">
                {calendar.name}
              </Link>
              {calendar.description ? <p className="mt-2 text-zinc-600">{calendar.description}</p> : null}
              <p className="mt-3 text-sm text-zinc-600">
                {calendar.publishedEventCount} {labels.publishedEvents} · {calendar.followerCount} {labels.followers}
                {calendar.averageAttendance != null
                  ? ` · ${Math.round(calendar.averageAttendance * 100)}% ${labels.attendance}`
                  : ""}
              </p>
              {calendar.tags.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {calendar.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-sm">
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
