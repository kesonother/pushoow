"use client";

import { useEffect } from "react";
import type { EmbedKind } from "@/domain/embed/types";

export function EmbedBeacon({ kind, resourceId, track }: { kind: EmbedKind; resourceId: string; track: boolean }) {
  useEffect(() => {
    if (!track) return;
    void fetch("/api/v1/embeds/impressions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, resourceId, track: true }),
      keepalive: true,
    });
  }, [kind, resourceId, track]);
  return null;
}
