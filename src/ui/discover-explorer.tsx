"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapEmbedBbox } from "@/domain/event/geocoding";
import { useI18n } from "@/i18n/client";
import { formatEventDateTime } from "@/i18n/datetime";
import type { Dictionary } from "@/i18n/dictionaries";
import { TEXT_OVERFLOW_CLASS } from "@/i18n/overflow";
import { Button } from "@/ui/button";
import { chipClassName } from "@/ui/control";
import { Input } from "@/ui/input";
import { SelectField } from "@/ui/select-field";

type Labels = Dictionary["discover"];

type PublicCard = {
  event: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    startsAt: string;
    timezone: string;
    tags: string[];
    city: string | null;
    country: string | null;
    category: string | null;
    language: string | null;
    venueName: string | null;
    latitude: number | null;
    longitude: number | null;
    capacity: number | null;
    coverImageUrl: string | null;
  };
  calendarName: string;
  calendarSlug: string;
  organizerName: string;
  format: "online" | "in-person" | "hybrid";
  minPriceCents: number;
  trendingScore: number;
};

type Facet = { value: string; count: number };

type PagePayload = {
  items: PublicCard[];
  nextCursor: string | null;
  facets: {
    city: Facet[];
    date: Facet[];
    format: Facet[];
    tag: Facet[];
    price: Facet[];
    language: Facet[];
    capacity: Facet[];
  };
};

type SectionsPayload = {
  trending: PublicCard[];
  editorsPicks: PublicCard[];
  newOnPlatform: PublicCard[];
  closingSoon: PublicCard[];
};

type MapPayload = {
  clusters: Array<{ id: string; latitude: number; longitude: number; count: number; eventIds: string[] }>;
  events: PublicCard[];
  unlocated: PublicCard[];
};

const FILTER_KEYS = [
  "q",
  "location",
  "city",
  "country",
  "date",
  "dateFrom",
  "dateTo",
  "tag",
  "category",
  "format",
  "price",
  "language",
] as const;

function formatPrice(cents: number, labels: Labels) {
  if (cents <= 0) return labels.free;
  return `${(cents / 100).toFixed(0)}`;
}

function formatLabel(value: string, labels: Labels) {
  const map: Record<string, string> = {
    online: labels.online,
    "in-person": labels.inPerson,
    hybrid: labels.hybrid,
    free: labels.free,
    under_25: labels.under25,
    under_100: labels.under100,
    paid: labels.paid,
    today: labels.today,
    this_week: labels.thisWeek,
    this_month: labels.thisMonth,
    later: labels.later,
  };
  return map[value] ?? value;
}

function EventCard({
  card,
  selected,
  onSelect,
}: {
  card: PublicCard;
  selected?: boolean;
  onSelect?: (card: PublicCard) => void;
}) {
  const { locale } = useI18n();
  const meta = (
    <>
      <h3 className={`text-[14px] font-bold text-[#171717] ${TEXT_OVERFLOW_CLASS}`}>{card.event.title}</h3>
      <p className="mt-0.5 text-[12px] text-zinc-600">
        {formatEventDateTime(new Date(card.event.startsAt), card.event.timezone, locale)}
      </p>
      <p className="mt-0.5 text-[12px] text-zinc-600">
        {card.organizerName}
        {card.event.city ? ` · ${card.event.city}` : ""}
      </p>
    </>
  );
  return (
    <article>
      <div
        className={`flex gap-3 rounded-xl border border-[#E8E8E8] bg-white p-2.5 transition-colors hover:border-zinc-300 hover:bg-[#FAFAFA] ${selected ? "border-zinc-400 bg-[#FAFAFA]" : ""}`}
      >
        {card.event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.event.coverImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-[10px] object-cover" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[10px] bg-[#FAFAFA] text-[11px] font-medium text-zinc-600">
            {card.format}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {onSelect ? (
            <button type="button" className="w-full min-h-11 text-start" aria-pressed={selected} onClick={() => onSelect(card)}>
              {meta}
            </button>
          ) : (
            meta
          )}
          <Link
            className="mt-1 inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70"
            href={`/e/${card.event.slug}`}
          >
            {card.event.title}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function DiscoverExplorer({ labels }: { labels: Labels }) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<PublicCard[]>([]);
  const [facets, setFacets] = useState<PagePayload["facets"] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionsPayload | null>(null);
  const [map, setMap] = useState<MapPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState("");
  const [intentHint, setIntentHint] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map" | "both">("both");
  const sentinel = useRef<HTMLDivElement | null>(null);
  const queryKey = searchParams.toString();

  const filters = useMemo(() => {
    const next: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) next[key] = value;
    }
    return next;
  }, [searchParams]);

  const replaceFilters = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      params.delete("cursor");
      router.replace(`/discover?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const loadMore = useCallback(async (cursor: string) => {
    const params = new URLSearchParams(queryKey);
    params.set("cursor", cursor);
    const response = await fetch(`/api/v1/discover?${params.toString()}`);
    if (!response.ok) throw new Error("unavailable");
    const payload = (await response.json()) as { data: PagePayload };
    setItems((current) => [...current, ...payload.data.items]);
    setNextCursor(payload.data.nextCursor);
  }, [queryKey]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(queryKey);
    Promise.all([
      fetch(`/api/v1/discover?${params.toString()}`).then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<{ data: PagePayload }>;
      }),
      fetch("/api/v1/discover/sections").then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<{ data: SectionsPayload }>;
      }),
      fetch(`/api/v1/discover/map?${queryKey}`).then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<{ data: MapPayload }>;
      }),
    ])
      .then(([pagePayload, sectionPayload, mapPayload]) => {
        if (cancelled) return;
        setItems(pagePayload.data.items);
        setNextCursor(pagePayload.data.nextCursor);
        setFacets(pagePayload.data.facets);
        setSections(sectionPayload.data);
        setMap(mapPayload.data);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(labels.unavailable);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [labels.unavailable, queryKey]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !nextCursor) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && nextCursor) {
        loadMore(nextCursor).catch(() => setError(labels.unavailable));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [labels.unavailable, loadMore, nextCursor]);

  const selected =
    items.find((item) => item.event.id === selectedId) ??
    map?.events.find((item) => item.event.id === selectedId) ??
    null;

  const embed = useMemo(() => {
    if (selected?.event.latitude != null && selected.event.longitude != null) {
      return mapEmbedBbox(
        {
          west: selected.event.longitude - 0.04,
          south: selected.event.latitude - 0.03,
          east: selected.event.longitude + 0.04,
          north: selected.event.latitude + 0.03,
        },
        { latitude: selected.event.latitude, longitude: selected.event.longitude },
      );
    }
    const cluster = map?.clusters[0];
    if (!cluster) return null;
    return mapEmbedBbox(
      {
        west: cluster.longitude - 0.2,
        south: cluster.latitude - 0.15,
        east: cluster.longitude + 0.2,
        north: cluster.latitude + 0.15,
      },
      { latitude: cluster.latitude, longitude: cluster.longitude },
    );
  }, [map, selected]);

  function useLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      replaceFilters({
        west: String(longitude - 0.4),
        south: String(latitude - 0.3),
        east: String(longitude + 0.4),
        north: String(latitude + 0.3),
      });
    });
  }

  async function applyIntent() {
    if (!intent.trim()) return;
    setIntentHint(null);
    const response = await fetch("/api/v1/discover/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: intent }),
    });
    if (!response.ok) {
      setError(labels.unavailable);
      return;
    }
    const payload = await response.json();
    const filters = payload.data?.interpretation?.filters ?? {};
    replaceFilters({
      q: filters.q,
      city: filters.city,
      tag: filters.tag,
      format: filters.format,
      price: filters.price,
      location: filters.location,
      dateFrom: typeof filters.dateFrom === "string" ? filters.dateFrom.slice(0, 10) : undefined,
      dateTo: typeof filters.dateTo === "string" ? filters.dateTo.slice(0, 10) : undefined,
    });
    setIntentHint(labels.aiSuggestion);
  }

  const sectionRows: Array<[keyof SectionsPayload, string]> = [
    ["trending", labels.trending],
    ["editorsPicks", labels.editorsPicks],
    ["newOnPlatform", labels.newOnPlatform],
    ["closingSoon", labels.closingSoon],
  ];

  return (
    <div className="grid gap-8">
      <form
        key={queryKey}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          replaceFilters({
            q: String(form.get("q") ?? "") || undefined,
            location: String(form.get("location") ?? "") || undefined,
            city: String(form.get("city") ?? "") || undefined,
            country: String(form.get("country") ?? "") || undefined,
            dateFrom: String(form.get("dateFrom") ?? "") || undefined,
            tag: String(form.get("tag") ?? "") || undefined,
            category: String(form.get("category") ?? "") || undefined,
            language: String(form.get("language") ?? "") || undefined,
            format: String(form.get("format") ?? "") || undefined,
            price: String(form.get("price") ?? "") || undefined,
          });
        }}
      >
        <Input name="q" label={labels.search} defaultValue={filters.q} placeholder={labels.searchPlaceholder} />
        <Input name="location" label={labels.location} defaultValue={filters.location} />
        <Input name="city" label={labels.city} defaultValue={filters.city} />
        <Input name="country" label={labels.country} defaultValue={filters.country} />
        <Input name="dateFrom" type="date" label={labels.date} defaultValue={filters.dateFrom} />
        <Input name="tag" label={labels.tag} defaultValue={filters.tag} />
        <Input name="category" label={labels.category} defaultValue={filters.category} />
        <Input name="language" label={labels.language} defaultValue={filters.language} />
        <SelectField name="format" label={labels.format} defaultValue={filters.format ?? ""}>
          <option value="">{t.common.none}</option>
          <option value="online">{labels.online}</option>
          <option value="in-person">{labels.inPerson}</option>
          <option value="hybrid">{labels.hybrid}</option>
        </SelectField>
        <SelectField name="price" label={labels.price} defaultValue={filters.price ?? ""}>
          <option value="">{t.common.none}</option>
          <option value="free">{labels.free}</option>
          <option value="under_25">{labels.under25}</option>
          <option value="under_100">{labels.under100}</option>
          <option value="paid">{labels.paid}</option>
        </SelectField>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit">{labels.filters}</Button>
          <Button type="button" variant="secondary" onClick={() => router.replace("/discover")}>
            {labels.reset}
          </Button>
          <Button type="button" variant="ghost" onClick={useLocation}>
            {labels.useLocation}
          </Button>
        </div>
      </form>

      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          applyIntent().catch(() => setError(labels.unavailable));
        }}
      >
        <Input
          name="intent"
          label={labels.intent}
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          placeholder={labels.intentPlaceholder}
        />
        <div className="flex items-end">
          <Button type="submit">{labels.intentApply}</Button>
        </div>
        {intentHint ? <p className="text-sm text-zinc-600 sm:col-span-2">{intentHint}</p> : null}
      </form>

      {facets ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={labels.filters}>
          {facets.date.map((facet) => (
            <button
              key={`date-${facet.value}`}
              type="button"
              className={chipClassName}
              onClick={() => replaceFilters({ date: facet.value, dateFrom: undefined })}
            >
              {formatLabel(facet.value, labels)} ({facet.count})
            </button>
          ))}
          {facets.city.map((facet) => (
            <button
              key={`city-${facet.value}`}
              type="button"
              className={chipClassName}
              onClick={() => replaceFilters({ city: facet.value })}
            >
              {facet.value} ({facet.count})
            </button>
          ))}
          {facets.tag.map((facet) => (
            <button
              key={`tag-${facet.value}`}
              type="button"
              className={chipClassName}
              onClick={() => replaceFilters({ tag: facet.value })}
            >
              #{facet.value} ({facet.count})
            </button>
          ))}
          {facets.capacity.map((facet) => (
            <span key={`capacity-${facet.value}`} className="rounded-full border border-[#E8E8E8] px-3 py-1 text-sm text-zinc-600">
              {facet.value} ({facet.count})
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2" role="group" aria-label={labels.list}>
        <Button type="button" variant={view === "list" ? "primary" : "secondary"} aria-pressed={view === "list"} onClick={() => setView("list")}>
          {labels.list}
        </Button>
        <Button type="button" variant={view === "map" ? "primary" : "secondary"} aria-pressed={view === "map"} onClick={() => setView("map")}>
          {labels.map}
        </Button>
      </div>

      {error ? (
        <p role="alert">
          {error}{" "}
          <Link className="underline" href="/calendars">
            {t.emptyState.browseCalendars}
          </Link>
        </p>
      ) : null}

      {sections && !queryKey ? (
        <div className="grid gap-6">
          {sectionRows.map(([key, title]) =>
            sections[key].length > 0 ? (
              <section key={key}>
                <h2 className="mb-3 text-[16px] font-bold tracking-tight text-[#171717]">{title}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {sections[key].map((card) => (
                    <li key={card.event.id}>
                      <EventCard card={card} onSelect={(item) => setSelectedId(item.event.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>
      ) : null}

      <div className={`grid gap-6 ${view === "both" ? "lg:grid-cols-2" : ""}`}>
        {view !== "map" ? (
          <section>
            <h2 className="mb-3 text-[16px] font-bold tracking-tight text-[#171717]">{labels.list}</h2>
            {loading && items.length === 0 ? <p>{t.common.loading}</p> : null}
            {items.length === 0 && !loading && !error ? (
              <p>
                {labels.empty}{" "}
                <Link className="underline" href="/calendars">
                  {t.emptyState.browseCalendars}
                </Link>
              </p>
            ) : null}
            <ul className="grid gap-3">
              {items.map((card) => (
                <li key={card.event.id}>
                  <EventCard
                    card={card}
                    selected={card.event.id === selectedId}
                    onSelect={(item) => setSelectedId(item.event.id)}
                  />
                </li>
              ))}
            </ul>
            <div ref={sentinel} className="h-8" />
            {nextCursor ? (
              <Button type="button" variant="secondary" onClick={() => loadMore(nextCursor)}>
                {labels.loadMore}
              </Button>
            ) : null}
          </section>
        ) : null}

        {view !== "list" ? (
          <section>
            <h2 className="mb-3 text-[16px] font-bold tracking-tight text-[#171717]">{labels.map}</h2>
            {embed ? (
              <iframe title={labels.map} src={embed} className="h-72 w-full rounded-xl border border-[#E8E8E8]" loading="lazy" />
            ) : (
              <p>{labels.unlocated}</p>
            )}
            {map && map.clusters.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label={labels.clusters}>
                {map.clusters.map((cluster) => (
                  <li key={cluster.id}>
                    <button
                      type="button"
                      className={chipClassName}
                      aria-label={`${labels.clusters}: ${cluster.count}`}
                      onClick={() => setSelectedId(cluster.eventIds[0] ?? null)}
                    >
                      {cluster.count}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected ? (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">{labels.selected}</h3>
                <EventCard card={selected} selected />
                <p className="mt-2 text-sm text-zinc-600">{formatPrice(selected.minPriceCents, labels)}</p>
              </div>
            ) : null}
            {map && map.unlocated.length > 0 ? (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">{labels.unlocated}</h3>
                <ul className="grid gap-2">
                  {map.unlocated.slice(0, 8).map((card) => (
                    <li key={card.event.id}>
                      <Link className="underline" href={`/e/${card.event.slug}`}>
                        {card.event.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
