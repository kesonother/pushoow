"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";

type Recap = {
  attendanceRate: number | null;
  engagement: {
    pageViews: number;
    rsvps: number;
    checkedIn: number;
    emailOpenRate: number | null;
    chatMessages: number;
  };
  chatTopics: Array<{ value: string; reason: string }>;
  demographics: { available: boolean; reason: string | null };
  keyMetrics: Array<{ label: string; value: string }>;
  disclosure: string;
  certainty: string;
};

export function EventAiRecap({
  organizationId,
  eventId,
  labels,
}: {
  organizationId: string;
  eventId: string;
  labels: {
    recap: string;
    recapHint: string;
    recapRun: string;
    unavailable: string;
    recapAttendance: string;
    recapEngagement: string;
    recapTopics: string;
    recapDemographics: string;
    rsvp: string;
    checkedIn: string;
    views: string;
    suggestions: string;
    available: string;
    unavailableValue: string;
  };
}) {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/v1/organizations/${organizationId}/events/${eventId}/ai/recap`, {
      method: "POST",
    });
    setLoading(false);
    if (!response.ok) {
      setError(labels.unavailable);
      return;
    }
    const payload = await response.json();
    setRecap(payload.data as Recap);
  }

  return (
    <Card>
      <h2 className="text-lg font-medium">{labels.recap}</h2>
      <p className="mt-1 text-sm text-zinc-600">{labels.recapHint}</p>
      <div className="mt-3">
        <Button type="button" variant="secondary" onClick={() => run()} disabled={loading}>
          {labels.recapRun}
        </Button>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      {recap ? (
        <div className="mt-4 grid gap-2 text-sm">
          <p>
            {labels.recapAttendance}: {recap.attendanceRate == null ? "—" : `${Math.round(recap.attendanceRate * 100)}%`}
          </p>
          <p>
            {labels.recapEngagement}: {recap.engagement.rsvps} {labels.rsvp} · {recap.engagement.checkedIn}{" "}
            {labels.checkedIn} · {recap.engagement.pageViews} {labels.views}
          </p>
          {recap.chatTopics.length > 0 ? (
            <p>
              {labels.recapTopics} ({labels.suggestions}): {recap.chatTopics.map((topic) => topic.value).join(", ")}
            </p>
          ) : null}
          <p>
            {labels.recapDemographics}:{" "}
            {recap.demographics.available ? labels.available : recap.demographics.reason ?? labels.unavailableValue}
          </p>
          <p className="text-zinc-600">{recap.disclosure}</p>
        </div>
      ) : null}
    </Card>
  );
}
