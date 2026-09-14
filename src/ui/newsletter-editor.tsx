"use client";

import { useState } from "react";
import type { NewsletterBlock } from "@/domain/notification/types";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

type Labels = {
  subjectA: string;
  subjectB: string;
  add: string;
  previewDesktop: string;
  previewMobile: string;
  save: string;
  send: string;
  unavailable: string;
};

const BLOCK_TYPES: NewsletterBlock["type"][] = [
  "title",
  "paragraph",
  "event_embed",
  "image",
  "divider",
  "button",
];

function emptyBlock(type: NewsletterBlock["type"]): NewsletterBlock {
  if (type === "title" || type === "paragraph") return { type, text: "" };
  if (type === "event_embed") return { type, eventId: "", title: "" };
  if (type === "image") return { type, src: "", alt: "" };
  if (type === "button") return { type, label: "", href: "" };
  return { type: "divider" };
}

export function NewsletterEditor({
  calendarId,
  labels,
}: {
  calendarId: string;
  labels: Labels;
}) {
  const [subjectA, setSubjectA] = useState("");
  const [subjectB, setSubjectB] = useState("");
  const [blocks, setBlocks] = useState<NewsletterBlock[]>([{ type: "title", text: "" }]);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [html, setHtml] = useState("");
  const [id, setId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const response = await fetch(id ? `/api/v1/newsletters/${id}` : `/api/v1/calendars/${calendarId}/newsletters`, {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subjectA, subjectB: subjectB || null, blocks }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? labels.unavailable);
      return null;
    }
    setId(payload.data.id);
    return payload.data.id as string;
  }

  async function preview(next: "desktop" | "mobile") {
    const savedId = await save();
    if (!savedId) return;
    setViewport(next);
    const response = await fetch(`/api/v1/newsletters/${savedId}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ viewport: next }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? labels.unavailable);
      return;
    }
    setHtml(payload.data.html);
  }

  async function send() {
    const savedId = await save();
    if (!savedId) return;
    const response = await fetch(`/api/v1/newsletters/${savedId}/send`, { method: "POST" });
    if (!response.ok) setError(labels.unavailable);
  }

  return (
    <div className="grid gap-4">
      <Input label={labels.subjectA} value={subjectA} onChange={(event) => setSubjectA(event.target.value)} />
      <Input label={labels.subjectB} value={subjectB} onChange={(event) => setSubjectB(event.target.value)} />
      <ul className="grid gap-3">
        {blocks.map((block, index) => (
          <li key={`${block.type}-${index}`} className="rounded-xl border border-zinc-200 p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">{block.type}</p>
            {"text" in block ? (
              <textarea
                className="min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={block.text}
                onChange={(event) => {
                  const next = [...blocks];
                  next[index] = { ...block, text: event.target.value };
                  setBlocks(next);
                }}
              />
            ) : null}
            {block.type === "event_embed" ? (
              <Input
                label="Event"
                value={block.eventId}
                onChange={(event) => {
                  const next = [...blocks];
                  next[index] = { ...block, eventId: event.target.value };
                  setBlocks(next);
                }}
              />
            ) : null}
            {block.type === "image" ? (
              <div className="grid gap-2">
                <Input
                  label="URL"
                  value={block.src}
                  onChange={(event) => {
                    const next = [...blocks];
                    next[index] = { ...block, src: event.target.value };
                    setBlocks(next);
                  }}
                />
                <Input
                  label="Alt"
                  value={block.alt}
                  onChange={(event) => {
                    const next = [...blocks];
                    next[index] = { ...block, alt: event.target.value };
                    setBlocks(next);
                  }}
                />
              </div>
            ) : null}
            {block.type === "button" ? (
              <div className="grid gap-2">
                <Input
                  label="Label"
                  value={block.label}
                  onChange={(event) => {
                    const next = [...blocks];
                    next[index] = { ...block, label: event.target.value };
                    setBlocks(next);
                  }}
                />
                <Input
                  label="URL"
                  value={block.href}
                  onChange={(event) => {
                    const next = [...blocks];
                    next[index] = { ...block, href: event.target.value };
                    setBlocks(next);
                  }}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((type) => (
          <Button key={type} type="button" variant="secondary" onClick={() => setBlocks((current) => [...current, emptyBlock(type)])}>
            {labels.add} {type}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save}>
          {labels.save}
        </Button>
        <Button type="button" variant="secondary" onClick={() => preview("desktop")}>
          {labels.previewDesktop}
        </Button>
        <Button type="button" variant="secondary" onClick={() => preview("mobile")}>
          {labels.previewMobile}
        </Button>
        <Button type="button" variant="secondary" onClick={send}>
          {labels.send}
        </Button>
      </div>
      {html ? (
        <iframe
          title={viewport}
          className="min-h-64 rounded-2xl border border-zinc-200 bg-white"
          style={{ width: viewport === "mobile" ? 360 : 640, maxWidth: "100%" }}
          srcDoc={html}
        />
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
