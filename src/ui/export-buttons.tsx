"use client";

import { Button } from "@/ui/button";

export function ExportButtons({
  kind,
  organizationId,
  eventId,
  label,
}: {
  kind: "organizer" | "event" | "registrants" | "attendee";
  organizationId?: string;
  eventId?: string;
  label: string;
}) {
  async function download(format: "csv" | "xlsx" | "json") {
    const response = await fetch("/api/v1/exports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, format, organizationId, eventId }),
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `export.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <span className="self-center text-sm text-zinc-600">{label}</span>
      <Button type="button" variant="secondary" onClick={() => void download("csv")}>
        CSV
      </Button>
      <Button type="button" variant="secondary" onClick={() => void download("xlsx")}>
        XLSX
      </Button>
      <Button type="button" variant="secondary" onClick={() => void download("json")}>
        JSON
      </Button>
    </div>
  );
}
