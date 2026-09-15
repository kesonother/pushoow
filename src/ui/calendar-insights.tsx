import Link from "next/link";
import type { OrganizerInsights } from "@/domain/discovery/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { Card } from "@/ui/card";

export function CalendarInsights({
  insights,
  labels,
}: {
  insights: OrganizerInsights;
  labels: Dictionary["discover"];
}) {
  return (
    <Card>
      <h2 className="text-lg font-medium">{labels.insights}</h2>
      <div className="mt-4 grid gap-4 text-sm">
        <section>
          <h3 className="font-semibold">{labels.discoveryInsights}</h3>
          <p className="mt-1 text-zinc-600">
            {insights.discovery.upcomingEventCount} · {insights.discovery.trendingEventCount} {labels.trending}
          </p>
          {insights.discovery.topTags.length > 0 ? (
            <p className="mt-1 text-zinc-600">{insights.discovery.topTags.join(", ")}</p>
          ) : null}
        </section>
        <section>
          <h3 className="font-semibold">{labels.tagSuggestions}</h3>
          <p className="mt-1 text-zinc-600">
            {insights.tagSuggestions.length > 0 ? insights.tagSuggestions.join(", ") : "—"}
          </p>
        </section>
        <section>
          <h3 className="font-semibold">{labels.similarCalendars}</h3>
          <ul className="mt-1 grid gap-1">
            {insights.similarCalendars.map((calendar) => (
              <li key={calendar.id}>
                <Link className="underline" href={`/c/${calendar.slug}`}>
                  {calendar.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-semibold">{labels.partnerships}</h3>
          <ul className="mt-1 grid gap-1">
            {insights.partnerships.map((calendar) => (
              <li key={calendar.id}>
                <Link className="underline" href={`/c/${calendar.slug}`}>
                  {calendar.name}
                </Link>
                <span className="text-zinc-600"> · {calendar.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Card>
  );
}