"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  anonymous: boolean;
};

export function EventRoster({
  eventId,
  labels,
}: {
  eventId: string;
  labels: { title: string; hidden: string };
}) {
  const [hidden, setHidden] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    fetch(`/api/v1/events/${eventId}/roster`)
      .then((response) => response.json())
      .then((payload) => {
        setHidden(!payload.data?.visible);
        setEntries(payload.data?.entries ?? []);
      })
      .catch(() => setHidden(true));
  }, [eventId]);

  return (
    <section className="grid gap-2">
      <h2 className="text-xl font-semibold">{labels.title}</h2>
      {hidden ? <p className="text-sm text-zinc-600">{labels.hidden}</p> : null}
      {!hidden ? (
        <ul className="grid gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              {entry.displayName ?? "—"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
