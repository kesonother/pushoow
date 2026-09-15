import type { OrganizerInsights } from "@/domain/discovery/types";
import type { Event } from "@/domain/event/types";
import type { SmartSuggestions, SuggestionItem } from "@/domain/ai/types";
import { AI_DISCLOSURE, SUGGESTION_CERTAINTY } from "@/domain/ai/types";

export const SUGGESTIONS_DISCLAIMER =
  "These are suggestions only, not forecasts or guaranteed outcomes. Review before acting.";

function suggestion(value: string, reason: string): SuggestionItem {
  return { value, reason, kind: SUGGESTION_CERTAINTY };
}

function hourLabel(hour: number): string {
  const padded = String(hour).padStart(2, "0");
  return `${padded}:00`;
}

export function buildSmartSuggestions(input: {
  title?: string | null;
  tags?: string[];
  insights?: OrganizerInsights | null;
  events?: Event[];
  followerCount: number;
  providerId: string;
}): SmartSuggestions {
  const titleTokens = (input.title ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3);
  const insightTags = input.insights?.tagSuggestions ?? [];
  const ownTags = input.tags ?? [];
  const tagValues = [...new Set([...insightTags, ...titleTokens, ...ownTags])].slice(0, 6);
  const tags = tagValues.map((tag) =>
    suggestion(tag, "Based on nearby calendars and the current title — not a ranking."),
  );

  const starts = (input.events ?? [])
    .map((event) => event.startsAt.getUTCHours())
    .filter((hour) => Number.isFinite(hour));
  const hourCounts = new Map<number, number>();
  for (const hour of starts) hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  const popularHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const times = [
    suggestion(
      popularHour != null ? `Weekday ${hourLabel(popularHour)} UTC` : "Weekday 18:00 UTC",
      popularHour != null
        ? "Observed most often on this calendar's past events — not a prediction."
        : "Heuristic default for community events — not a prediction.",
    ),
    suggestion("Weekend 11:00 UTC", "Common workshop window — treat as a suggestion only."),
  ];

  const followerTargeting: SuggestionItem[] = [];
  if (input.followerCount > 0) {
    const segmentTag = ownTags[0] ?? insightTags[0] ?? "this calendar";
    followerTargeting.push(
      suggestion(
        `Followers interested in ${segmentTag}`,
        `Anonymous segment from ${input.followerCount} followers. No names or emails are included.`,
      ),
    );
  } else {
    followerTargeting.push(
      suggestion(
        "Grow the calendar audience before targeting segments",
        "No follower list is used. This is a suggestion, not a targeting fact.",
      ),
    );
  }

  return {
    kind: SUGGESTION_CERTAINTY,
    certainty: SUGGESTION_CERTAINTY,
    disclaimer: SUGGESTIONS_DISCLAIMER,
    aiGenerated: true,
    disclosure: AI_DISCLOSURE,
    tags,
    times,
    followerTargeting,
    providerId: input.providerId,
  };
}
