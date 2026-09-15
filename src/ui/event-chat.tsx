"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

type ChatMessage = {
  id: string;
  seq: number;
  threadId: string;
  parentId: string | null;
  authorKind: "user" | "organizer";
  authorUserId: string | null;
  body: string;
  clientId: string | null;
  deletedAt: string | Date | null;
  createdAt: string | Date;
  pending?: boolean;
};

type Rights = { read: boolean; post: boolean; moderate: boolean; organizer: boolean };

export function EventChat({
  eventId,
  labels,
}: {
  eventId: string;
  labels: Record<string, string>;
}) {
  const { t } = useI18n();
  const [rights, setRights] = useState<Rights | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [asOrganizer, setAsOrganizer] = useState(false);
  const lastSeq = useRef(0);
  const seen = useRef(new Set<string>());

  const merge = useCallback((incoming: ChatMessage[]) => {
    setMessages((current) => {
      const next = [...current];
      for (const item of incoming) {
        const key = item.id || item.clientId || `${item.seq}`;
        const existing = next.findIndex(
          (row) => row.id === item.id || (item.clientId && row.clientId === item.clientId),
        );
        if (existing >= 0) next[existing] = { ...next[existing], ...item, pending: false };
        else if (!seen.current.has(key)) next.push(item);
        seen.current.add(key);
        lastSeq.current = Math.max(lastSeq.current, item.seq || 0);
      }
      next.sort((a, b) => a.seq - b.seq || a.createdAt.toString().localeCompare(b.createdAt.toString()));
      return next;
    });
  }, []);

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;
    async function boot() {
      const access = await fetch(`/api/v1/events/${eventId}/chat`);
      if (access.status === 403 || access.status === 401) {
        setDenied(true);
        return;
      }
      const accessPayload = await access.json();
      if (!access.ok) {
        setError(accessPayload.error?.message ?? labels.unavailable);
        return;
      }
      if (cancelled) return;
      setRights(accessPayload.data.rights);
      const history = await fetch(`/api/v1/events/${eventId}/chat/messages?limit=30`);
      const page = await history.json();
      if (history.ok) {
        merge(page.data.items ?? []);
        setCursor(page.data.nextCursor ?? null);
      }
      source = new EventSource(`/api/v1/events/${eventId}/chat/stream?afterSeq=${lastSeq.current}`);
      const onEvent = (event: MessageEvent) => {
        const payload = JSON.parse(event.data) as { payload?: ChatMessage; type?: string };
        if (payload.payload && (payload.type === "message" || payload.type === "deleted")) {
          merge([payload.payload]);
        }
      };
      source.addEventListener("message", onEvent);
      source.addEventListener("deleted", onEvent);
      source.onerror = () => {
        source?.close();
        if (cancelled) return;
        source = new EventSource(`/api/v1/events/${eventId}/chat/stream?afterSeq=${lastSeq.current}`);
        source.addEventListener("message", onEvent);
        source.addEventListener("deleted", onEvent);
      };
    }
    boot().catch(() => setError(labels.unavailable));
    return () => {
      cancelled = true;
      source?.close();
    };
  }, [eventId, labels.unavailable, merge]);

  const visible = useMemo(
    () => messages.filter((item) => !item.parentId || messages.some((row) => row.id === item.parentId)),
    [messages],
  );

  if (denied) return <p className="text-sm text-zinc-600">{labels.restricted}</p>;
  if (!rights) return error ? <p className="text-sm text-red-700">{error}</p> : null;

  async function loadOlder() {
    if (!cursor) return;
    const response = await fetch(`/api/v1/events/${eventId}/chat/messages?limit=30&cursor=${cursor}`);
    const page = await response.json();
    if (response.ok) {
      merge(page.data.items ?? []);
      setCursor(page.data.nextCursor ?? null);
    }
  }

  async function send() {
    const text = body.trim();
    if (!text) return;
    const clientId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: clientId,
      seq: lastSeq.current + 1,
      threadId: "",
      parentId: null,
      authorKind: asOrganizer ? "organizer" : "user",
      authorUserId: null,
      body: text,
      clientId,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    merge([optimistic]);
    setBody("");
    const response = await fetch(`/api/v1/events/${eventId}/chat/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: text, clientId, asOrganizer }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? labels.unavailable);
      setMessages((current) => current.filter((item) => item.clientId !== clientId || !item.pending));
      return;
    }
    merge([payload.data]);
  }

  async function report(id: string) {
    const reason = window.prompt(labels.reportReason);
    if (!reason) return;
    await fetch(`/api/v1/events/${eventId}/chat/messages/${id}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  }

  async function remove(id: string, hard = false) {
    await fetch(`/api/v1/events/${eventId}/chat/messages/${id}/moderate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: hard ? "hard_delete" : "soft_delete", reason: t.event.chatRemovedReason }),
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{labels.title}</h2>
        {cursor ? (
          <Button type="button" variant="ghost" onClick={loadOlder}>
            {labels.older}
          </Button>
        ) : null}
      </div>
      <ul className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-[#E8E8E8] p-3">
        {visible.map((item) => (
          <li key={item.id} className={`text-sm ${item.pending ? "opacity-60" : ""}`}>
            <p className="font-medium text-zinc-700">
              {item.authorKind === "organizer" ? labels.organizer : labels.member}
            </p>
            <p>{item.deletedAt ? labels.deleted : item.body}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              <button type="button" className="underline" onClick={() => report(item.id)}>
                {labels.report}
              </button>
              {rights.moderate ? (
                <>
                  <button type="button" className="underline" onClick={() => remove(item.id)}>
                    {labels.delete}
                  </button>
                  <button type="button" className="underline" onClick={() => remove(item.id, true)}>
                    {labels.hardDelete}
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {rights.post ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Input label={labels.message} value={body} onChange={(e) => setBody(e.target.value)} />
          {rights.organizer ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={asOrganizer} onChange={(e) => setAsOrganizer(e.target.checked)} />
              {labels.asOrganizer}
            </label>
          ) : null}
          <Button type="submit">{labels.send}</Button>
        </form>
      ) : (
        <p className="text-sm text-zinc-600">{labels.closed}</p>
      )}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
