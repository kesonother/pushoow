import type { EventDashboard } from "@/domain/analytics/types";
import type { EventChatMessage } from "@/domain/chat/types";
import type { Event } from "@/domain/event/types";
import type { DemographicSummary, EventRecap, SuggestionItem } from "@/domain/ai/types";
import { AI_DISCLOSURE, SUGGESTION_CERTAINTY } from "@/domain/ai/types";
import { redactPii } from "@/domain/ai/safety";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "just",
  "about",
  "your",
  "what",
  "when",
  "will",
  "they",
  "them",
]);

function suggestion(value: string, reason: string): SuggestionItem {
  return { value, reason, kind: SUGGESTION_CERTAINTY };
}

export function extractChatTopics(messages: EventChatMessage[]): SuggestionItem[] {
  const counts = new Map<string, number>();
  for (const message of messages) {
    if (message.deletedAt || message.hardDeletedAt) continue;
    const redacted = redactPii(message.body).toLowerCase();
    for (const token of redacted.split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)) {
      if (token.length < 4 || STOPWORDS.has(token) || token.includes("redacted")) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([value, count]) => suggestion(value, `Appeared in ${count} aggregated chat tokens — not a quote.`));
}

export function demographicsForEvent(event: Event, processingAllowed: boolean): DemographicSummary {
  if (!processingAllowed) {
    return {
      available: false,
      legalBasis: null,
      reason: "insufficient_consent",
      aggregates: {},
    };
  }
  if (event.rosterMode === "hidden") {
    return {
      available: false,
      legalBasis: null,
      reason: "roster_hidden",
      aggregates: {},
    };
  }
  return {
    available: false,
    legalBasis: null,
    reason: "no_demographic_attributes",
    aggregates: {},
  };
}

export function buildEventRecap(input: {
  dashboard: Pick<
    EventDashboard,
    "attendance" | "pageViews" | "rsvps" | "funnel" | "emails" | "sms"
  >;
  event: Event;
  messages: EventChatMessage[];
  processingAllowed: boolean;
  providerId: string;
  model: string;
}): EventRecap {
  const emailOpenRate =
    input.dashboard.emails.sent > 0 ? input.dashboard.emails.opened / input.dashboard.emails.sent : null;
  const chatTopics = extractChatTopics(input.messages);
  const keyMetrics = [
    {
      label: "attendance_rate",
      value: input.dashboard.attendance.rate == null ? "unknown" : String(input.dashboard.attendance.rate),
      kind: SUGGESTION_CERTAINTY,
    },
    {
      label: "rsvps",
      value: String(input.dashboard.rsvps),
      kind: SUGGESTION_CERTAINTY,
    },
    {
      label: "page_views",
      value: String(input.dashboard.pageViews),
      kind: SUGGESTION_CERTAINTY,
    },
  ];
  return {
    attendanceRate: input.dashboard.attendance.rate,
    engagement: {
      pageViews: input.dashboard.pageViews,
      rsvps: input.dashboard.rsvps,
      checkedIn: input.dashboard.attendance.checkedIn,
      emailOpenRate,
      chatMessages: input.messages.filter((item) => !item.deletedAt && !item.hardDeletedAt).length,
    },
    chatTopics,
    demographics: demographicsForEvent(input.event, input.processingAllowed),
    keyMetrics,
    aiGenerated: true,
    disclosure: AI_DISCLOSURE,
    certainty: SUGGESTION_CERTAINTY,
    providerId: input.providerId,
    model: input.model,
  };
}
