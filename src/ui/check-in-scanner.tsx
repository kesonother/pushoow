"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CheckInManifest, CheckInResult, GuestManifestEntry } from "@/domain/checkin/types";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

type Labels = {
  scan: string;
  search: string;
  searchPlaceholder: string;
  ticketId: string;
  checkIn: string;
  checkAll: string;
  walkIn: string;
  walkInEmail: string;
  walkInTicket: string;
  doorList: string;
  offline: string;
  sync: string;
  counter: string;
  checkedIn: string;
  already: string;
  notOnList: string;
  wrongEvent: string;
  invalid: string;
  revoked: string;
};

const STATUS_STYLES: Record<string, string> = {
  checked_in: "border-emerald-700 bg-emerald-100 text-emerald-950",
  already_checked_in: "border-amber-700 bg-amber-100 text-amber-950",
  not_on_list: "border-zinc-600 bg-zinc-200 text-zinc-950",
  wrong_event: "border-violet-800 bg-violet-100 text-violet-950",
  invalid: "border-red-800 bg-red-100 text-red-950",
  revoked: "border-rose-950 bg-rose-200 text-rose-950",
};

const ELIGIBLE = new Set(["confirmed", "checked_in", "offered"]);

function deviceId() {
  const key = "pushoow.checkin.device";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

function storeKey(eventId: string) {
  return `pushoow.checkin.${eventId}`;
}

type StoredQueueOp = {
  clientOpId: string;
  token?: string;
  registrationId?: string;
  ticketCode?: string;
  checkedInAt: string;
};

type Stored = { manifest: CheckInManifest | null; queue: StoredQueueOp[] };

const storeListeners = new Set<() => void>();

function emitStore() {
  for (const listener of storeListeners) listener();
}

function subscribeStore(listener: () => void) {
  storeListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    storeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parseStore(raw: string | null): Stored {
  if (!raw) return { manifest: null, queue: [] };
  try {
    const parsed = JSON.parse(raw) as Stored;
    return { manifest: parsed.manifest ?? null, queue: parsed.queue ?? [] };
  } catch {
    return { manifest: null, queue: [] };
  }
}

function writeStore(eventId: string, value: Stored) {
  localStorage.setItem(storeKey(eventId), JSON.stringify(value));
  emitStore();
}

function useOnline() {
  return useSyncExternalStore(
    (onStore) => {
      window.addEventListener("online", onStore);
      window.addEventListener("offline", onStore);
      return () => {
        window.removeEventListener("online", onStore);
        window.removeEventListener("offline", onStore);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

function useCachedCheckIn(eventId: string): Stored {
  const raw = useSyncExternalStore(subscribeStore, () => localStorage.getItem(storeKey(eventId)), () => null);
  return parseStore(raw);
}

function peekQrEventId(token: string): string | null {
  const payload = token.split(".")[0];
  if (!payload) return null;
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded)) as { e?: string };
    return typeof json.e === "string" ? json.e : null;
  } catch {
    return null;
  }
}

export function CheckInScanner({
  eventId,
  title,
  isPaid,
  labels,
}: {
  eventId: string;
  title: string;
  isPaid: boolean;
  labels: Labels;
}) {
  const online = useOnline();
  const cached = useCachedCheckIn(eventId);
  const manifest = cached.manifest;
  const pending = cached.queue.length;
  const [query, setQuery] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInTicket, setWalkInTicket] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveCheckedIn, setLiveCheckedIn] = useState<number | null>(null);
  const [liveCapacity, setLiveCapacity] = useState<number | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const checkedIn = liveCheckedIn ?? manifest?.checkedIn ?? 0;
  const capacity = liveCapacity ?? manifest?.capacity ?? null;

  const guests = useMemo(() => {
    const list = manifest?.guests ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (guest) =>
        guest.displayName.toLowerCase().includes(needle) ||
        guest.email.toLowerCase().includes(needle) ||
        (guest.ticketCode && guest.ticketCode.toLowerCase().includes(needle)),
    );
  }, [manifest, query]);

  useEffect(() => {
    const onOnline = () => {
      void syncQueue();
    };
    window.addEventListener("online", onOnline);
    void loadManifest();
    const stream = new EventSource(`/api/v1/events/${eventId}/check-in/stream`);
    stream.addEventListener("counter", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { checkedIn: number; capacity: number | null };
      setLiveCheckedIn(payload.checkedIn);
      setLiveCapacity(payload.capacity);
    });
    return () => {
      window.removeEventListener("online", onOnline);
      stream.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function loadManifest() {
    const response = await fetch(`/api/v1/events/${eventId}/check-in/manifest`);
    if (!response.ok) return;
    const payload = await response.json();
    const next = payload.data as CheckInManifest;
    setLiveCheckedIn(next.checkedIn);
    setLiveCapacity(next.capacity);
    const existing = parseStore(localStorage.getItem(storeKey(eventId)));
    writeStore(eventId, { manifest: next, queue: existing.queue });
  }

  function queueOp(op: StoredQueueOp) {
    const parsed = parseStore(localStorage.getItem(storeKey(eventId)));
    parsed.queue.push(op);
    if (parsed.manifest && op.registrationId) {
      parsed.manifest = {
        ...parsed.manifest,
        checkedIn: parsed.manifest.checkedIn + 1,
        guests: parsed.manifest.guests.map((guest) =>
          guest.registrationId === op.registrationId ? { ...guest, status: "checked_in", checkedInAt: op.checkedInAt } : guest,
        ),
      };
      setLiveCheckedIn(parsed.manifest.checkedIn);
    }
    writeStore(eventId, parsed);
  }

  function evaluateOffline(body: Record<string, unknown>): CheckInResult {
    const clientOpId = crypto.randomUUID();
    const checkedInAt = new Date().toISOString();
    if (typeof body.token === "string") {
      const claimedEvent = peekQrEventId(body.token);
      if (claimedEvent && claimedEvent !== eventId) {
        return { status: "wrong_event", registrationId: null, displayName: null, checkedInAt: null, clientOpId };
      }
      const guest = manifest?.guests.find((item) => item.qrToken === body.token);
      if (!guest) return { status: "invalid", registrationId: null, displayName: null, checkedInAt: null, clientOpId };
      if (guest.status === "revoked") {
        return { status: "revoked", registrationId: guest.registrationId, displayName: guest.displayName, checkedInAt: null, clientOpId };
      }
      if (guest.status === "checked_in") {
        return {
          status: "already_checked_in",
          registrationId: guest.registrationId,
          displayName: guest.displayName,
          checkedInAt: guest.checkedInAt,
          clientOpId,
        };
      }
      if (!ELIGIBLE.has(guest.status)) {
        return { status: "not_on_list", registrationId: guest.registrationId, displayName: guest.displayName, checkedInAt: null, clientOpId };
      }
      queueOp({ clientOpId, token: body.token, registrationId: guest.registrationId, checkedInAt });
      return { status: "checked_in", registrationId: guest.registrationId, displayName: guest.displayName, checkedInAt, clientOpId };
    }
    const guest = manifest?.guests.find(
      (item) =>
        item.registrationId === body.registrationId ||
        (typeof body.ticketCode === "string" &&
          item.ticketCode &&
          item.ticketCode.toLowerCase() === body.ticketCode.trim().toLowerCase()) ||
        (typeof body.email === "string" && item.email.toLowerCase() === body.email.trim().toLowerCase()),
    );
    if (!guest) return { status: "not_on_list", registrationId: null, displayName: null, checkedInAt: null, clientOpId };
    if (guest.status === "revoked") {
      return { status: "revoked", registrationId: guest.registrationId, displayName: guest.displayName, checkedInAt: null, clientOpId };
    }
    if (guest.status === "checked_in") {
      return {
        status: "already_checked_in",
        registrationId: guest.registrationId,
        displayName: guest.displayName,
        checkedInAt: guest.checkedInAt,
        clientOpId,
      };
    }
    if (!ELIGIBLE.has(guest.status)) {
      return { status: "not_on_list", registrationId: guest.registrationId, displayName: guest.displayName, checkedInAt: null, clientOpId };
    }
    queueOp({
      clientOpId,
      registrationId: guest.registrationId,
      ticketCode: typeof body.ticketCode === "string" ? body.ticketCode : undefined,
      checkedInAt,
    });
    return { status: "checked_in", registrationId: guest.registrationId, displayName: guest.displayName, checkedInAt, clientOpId };
  }

  async function syncQueue() {
    const raw = localStorage.getItem(storeKey(eventId));
    if (!raw) return loadManifest();
    const parsed = JSON.parse(raw) as {
      queue: Array<{ clientOpId: string; token?: string; registrationId?: string; ticketCode?: string; checkedInAt: string }>;
    };
    if (parsed.queue.length === 0) return loadManifest();
    const response = await fetch(`/api/v1/events/${eventId}/check-in/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: deviceId(), checkIns: parsed.queue }),
    });
    if (!response.ok) return;
    const payload = await response.json();
    writeStore(eventId, { manifest: payload.data.manifest, queue: [] });
    setLiveCheckedIn(payload.data.manifest.checkedIn);
    setLiveCapacity(payload.data.manifest.capacity);
  }

  async function submit(body: Record<string, unknown>) {
    setError(null);
    if (!navigator.onLine) {
      setResult(evaluateOffline(body));
      return;
    }
    const clientOpId = crypto.randomUUID();
    const checkedInAt = new Date().toISOString();
    const response = await fetch(`/api/v1/events/${eventId}/check-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, clientOpId, deviceId: deviceId(), checkedInAt }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Check-in failed");
      return;
    }
    setResult(payload.data as CheckInResult);
    await loadManifest();
  }

  async function onScanFile(file: File) {
    const Detector = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: ImageBitmap) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!Detector) {
      setError("QR camera scan is not available on this browser. Search by name, email, or ticket id.");
      return;
    }
    const detector = new Detector({ formats: ["qr_code"] });
    const bitmap = await createImageBitmap(file);
    const codes = await detector.detect(bitmap);
    const token = codes[0]?.rawValue;
    if (!token) {
      setError("No QR code found");
      return;
    }
    await submit({ token, source: "scan" });
  }

  async function bulk(all = false) {
    const response = await fetch(`/api/v1/events/${eventId}/check-in/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all, registrationIds: selected, deviceId: deviceId() }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Bulk check-in failed");
      return;
    }
    setSelected([]);
    await loadManifest();
  }

  async function walkIn() {
    const response = await fetch(`/api/v1/events/${eventId}/check-in/walk-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: walkInEmail,
        ticketTypeId: isPaid ? walkInTicket || manifest?.ticketTypes?.[0]?.id : undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Walk-in failed");
      return;
    }
    if (payload.data?.kind === "paid" && payload.data.checkout?.checkoutUrl) {
      window.location.href = payload.data.checkout.checkoutUrl;
      return;
    }
    setWalkInEmail("");
    await loadManifest();
  }

  const statusLabel: Record<string, string> = {
    checked_in: labels.checkedIn,
    already_checked_in: labels.already,
    not_on_list: labels.notOnList,
    wrong_event: labels.wrongEvent,
    invalid: labels.invalid,
    revoked: labels.revoked,
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">{title}</p>
          <p className="text-3xl font-semibold tabular-nums" aria-live="polite">
            {labels.counter}: {checkedIn}
            {capacity != null ? ` / ${capacity}` : ""}
          </p>
        </div>
        <p className={`rounded-full px-3 py-1 text-sm ${online ? "bg-emerald-100" : "bg-amber-100"}`}>
          {online ? "Online" : labels.offline}
          {pending > 0 ? ` · ${pending}` : ""}
        </p>
      </div>
      {result ? (
        <p
          role="status"
          className={`rounded-2xl border-4 px-4 py-6 text-center text-2xl font-semibold ${STATUS_STYLES[result.status] ?? STATUS_STYLES.invalid}`}
        >
          {statusLabel[result.status] ?? result.status}
          {result.displayName ? ` · ${result.displayName}` : ""}
        </p>
      ) : null}
      <div className="grid gap-2">
        <p className="text-sm font-medium">{labels.scan}</p>
        {cameraOn ? (
          <CameraScan onToken={(token) => void submit({ token, source: "scan" })} onClose={() => setCameraOn(false)} />
        ) : (
          <Button type="button" variant="secondary" onClick={() => setCameraOn(true)}>
            {labels.scan}
          </Button>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="min-h-11 text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onScanFile(file);
          }}
        />
      </div>
      <Input
        name="search"
        label={labels.search}
        placeholder={labels.searchPlaceholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="flex gap-2">
        <Input
          name="ticketCode"
          label={labels.ticketId}
          value={ticketCode}
          onChange={(event) => setTicketCode(event.target.value)}
        />
        <Button type="button" className="self-end" onClick={() => void submit({ ticketCode, source: "search" })}>
          {labels.checkIn}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void bulk(false)} disabled={selected.length === 0}>
          {labels.checkIn} ({selected.length})
        </Button>
        <Button type="button" variant="secondary" onClick={() => void bulk(true)}>
          {labels.checkAll}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void syncQueue()}>
          {labels.sync}
        </Button>
        <a className="self-center text-sm underline" href={`/check-in/${eventId}/door-list`}>
          {labels.doorList}
        </a>
      </div>
      <div className="grid gap-2">
        <Input
          name="walkInEmail"
          type="email"
          label={labels.walkInEmail}
          value={walkInEmail}
          onChange={(event) => setWalkInEmail(event.target.value)}
        />
        {isPaid && (manifest?.ticketTypes.length ?? 0) > 0 ? (
          <label className="grid gap-1 text-sm font-medium">
            {labels.walkInTicket}
            <select
              className="min-h-11 rounded-lg border border-zinc-300 px-3"
              value={walkInTicket || manifest?.ticketTypes?.[0]?.id || ""}
              onChange={(event) => setWalkInTicket(event.target.value)}
            >
              {manifest?.ticketTypes.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  {ticket.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button type="button" onClick={() => void walkIn()}>
          {labels.walkIn}
          {isPaid ? " · Stripe" : ""}
        </Button>
      </div>
      <ul className="grid gap-2">
        {guests.map((guest) => (
          <GuestRow
            key={guest.registrationId}
            guest={guest}
            selected={selected.includes(guest.registrationId)}
            onSelect={(checked) =>
              setSelected((current) =>
                checked ? [...current, guest.registrationId] : current.filter((id) => id !== guest.registrationId),
              )
            }
            onCheck={() => void submit({ registrationId: guest.registrationId, source: "search" })}
            checkLabel={labels.checkIn}
          />
        ))}
      </ul>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function CameraScan({ onToken, onClose }: { onToken: (token: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastToken = useRef("");
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer = 0;
    let cancelled = false;
    const Detector = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    void (async () => {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (!Detector) return;
      const detector = new Detector({ formats: ["qr_code"] });
      timer = window.setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        void detector.detect(video).then((codes) => {
          const token = codes[0]?.rawValue;
          if (token && token !== lastToken.current) {
            lastToken.current = token;
            onTokenRef.current(token);
          }
        });
      }, 400);
    })();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="grid gap-2">
      <video ref={videoRef} className="aspect-[3/4] w-full rounded-xl bg-black object-cover" playsInline muted />
      <Button type="button" variant="ghost" onClick={onClose}>
        ×
      </Button>
    </div>
  );
}

function GuestRow({
  guest,
  selected,
  onSelect,
  onCheck,
  checkLabel,
}: {
  guest: GuestManifestEntry;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onCheck: () => void;
  checkLabel: string;
}) {
  const disabled = guest.status === "checked_in" || guest.status === "revoked";
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2">
      <label className="flex min-w-0 items-center gap-2 text-sm">
        <input type="checkbox" checked={selected} disabled={disabled} onChange={(event) => onSelect(event.target.checked)} />
        <span className="truncate">
          <strong>{guest.displayName}</strong>
          <span className="block text-zinc-500">{guest.email}</span>
        </span>
      </label>
      <Button type="button" variant="secondary" onClick={onCheck} disabled={disabled}>
        {guest.status === "checked_in" ? "✓" : guest.status === "revoked" ? "×" : checkLabel}
      </Button>
    </li>
  );
}
