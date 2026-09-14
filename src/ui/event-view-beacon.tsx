"use client";

import { useEffect } from "react";

export function EventViewBeacon({ eventId }: { eventId: string }) {
  useEffect(() => {
    void fetch(`/api/v1/events/${eventId}/view`, { method: "POST" });
  }, [eventId]);
  return null;
}
