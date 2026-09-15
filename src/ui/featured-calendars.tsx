"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/client";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";

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
  const { t } = useI18n();
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
      <p className="rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 text-[13px] text-zinc-700">{labels.notBuyable}</p>
      {error ? (
        <p role="alert">
          {error}{" "}
          <Link className="font-medium text-zinc-600 transition-opacity hover:opacity-70" href="/discover">
            {t.emptyState.discoverEvents}
          </Link>
        </p>
      ) : null}
      {ready && items.length === 0 && !error ? (
        <EmptyState
          title={labels.featuredEmpty}
          actionHref="/discover"
          actionLabel={t.emptyState.discoverEvents}
        />
      ) : null}
      <ul className="grid gap-4">
        {items.map((calendar) => (
          <li key={calendar.id}>
            <Card>
              <p className="text-xs uppercase tracking-wide text-zinc-600">{labels.eligibility}</p>
              <Link href={`/c/${calendar.slug}`} className="mt-1 block text-[16px] font-bold tracking-tight text-[#171717]">
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
