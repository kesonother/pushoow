"use client";

import { useMemo, useState } from "react";
import { fieldsForKind, requiredFields } from "@/domain/import/detect";
import type { ImportError, ImportField, ImportKind, ImportMapping, ImportPublicView, ImportReport } from "@/domain/import/types";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";

const STEPS = [
  "stepUpload",
  "stepDetect",
  "stepMapping",
  "stepPreview",
  "stepValidation",
  "stepImport",
  "stepReport",
] as const;

type Labels = {
  title: string;
  stepUpload: string;
  stepDetect: string;
  stepMapping: string;
  stepPreview: string;
  stepValidation: string;
  stepImport: string;
  stepReport: string;
  kind: string;
  guests: string;
  subscribers: string;
  events: string;
  calendar: string;
  calendarLabel: string;
  eventLabel: string;
  file: string;
  upload: string;
  next: string;
  back: string;
  commit: string;
  detected: string;
  mappingHint: string;
  previewHint: string;
  validationHint: string;
  imported: string;
  skipped: string;
  errors: string;
  downloadErrors: string;
  empty: string;
  none: string;
  fields: Record<ImportField, string>;
};

type CalendarOption = { id: string; name: string };
type EventOption = { id: string; title: string; calendarId: string };

export function ImportWizard({
  organizationId,
  calendars,
  events,
  initialKind,
  initialCalendarId,
  initialEventId,
  labels,
}: {
  organizationId: string;
  calendars: CalendarOption[];
  events: EventOption[];
  initialKind?: ImportKind;
  initialCalendarId?: string;
  initialEventId?: string;
  labels: Labels;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<ImportKind>(initialKind ?? "guests");
  const [calendarId, setCalendarId] = useState(initialCalendarId ?? calendars[0]?.id ?? "");
  const [eventId, setEventId] = useState(initialEventId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<ImportPublicView | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [preview, setPreview] = useState<Array<{ row: number; values: Record<string, string> }>>([]);
  const [validation, setValidation] = useState<ImportError[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const eventChoices = useMemo(
    () => events.filter((event) => !calendarId || event.calendarId === calendarId),
    [events, calendarId],
  );
  const fields = fieldsForKind(kind);
  const required = requiredFields(kind);

  async function readApi<T>(response: Response): Promise<T> {
    const payload = await response.json();
    if (!response.ok) throw new Error(apiMessage(payload, t.errors.requestFailed));
    return payload.data as T;
  }

  async function upload() {
    if (!file) throw new Error(labels.file);
    const body = new FormData();
    body.set("kind", kind);
    if (calendarId) body.set("calendarId", calendarId);
    if (eventId) body.set("eventId", eventId);
    body.set("file", file);
    const next = await readApi<ImportPublicView>(
      await fetch(`/api/v1/organizations/${organizationId}/imports`, { method: "POST", body }),
    );
    setJob(next);
    setMapping(next.mapping && Object.keys(next.mapping).length ? next.mapping : next.suggestedMapping);
    if (next.status === "committed" && next.report) {
      setReport(next.report);
      setStep(6);
      return;
    }
    setStep(1);
  }

  async function saveMapping() {
    if (!job) return;
    const next = await readApi<ImportPublicView>(
      await fetch(`/api/v1/organizations/${organizationId}/imports/${job.id}/mapping`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mapping }),
      }),
    );
    setJob(next);
  }

  async function loadPreview() {
    if (!job) return;
    const data = await readApi<{ rows: Array<{ row: number; values: Record<string, string> }> }>(
      await fetch(`/api/v1/organizations/${organizationId}/imports/${job.id}/preview`, { method: "POST" }),
    );
    setPreview(data.rows);
  }

  async function loadValidation() {
    if (!job) return;
    const data = await readApi<{ errors: ImportError[] }>(
      await fetch(`/api/v1/organizations/${organizationId}/imports/${job.id}/validate`, { method: "POST" }),
    );
    setValidation(data.errors);
  }

  async function runImport() {
    if (!job) return;
    const data = await readApi<ImportReport>(
      await fetch(`/api/v1/organizations/${organizationId}/imports/${job.id}/commit`, { method: "POST" }),
    );
    setReport(data);
    setStep(6);
  }

  async function goNext() {
    setPending(true);
    setError(null);
    try {
      if (step === 0) await upload();
      else if (step === 2) {
        await saveMapping();
        await loadPreview();
        setStep(3);
      } else if (step === 3) {
        await loadValidation();
        setStep(4);
      } else if (step === 5) await runImport();
      else setStep((current) => Math.min(6, current + 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <ol className="flex flex-wrap gap-2 text-xs text-zinc-600">
        {STEPS.map((key, index) => (
          <li
            key={key}
            className={`rounded-full px-3 py-1 ${index === step ? "bg-zinc-950 text-white" : "bg-zinc-100"}`}
          >
            {index + 1}. {labels[key]}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">{labels.kind}</span>
            <select
              className="min-h-11 rounded-lg border border-zinc-300 px-3"
              value={kind}
              onChange={(event) => setKind(event.target.value as ImportKind)}
            >
              <option value="guests">{labels.guests}</option>
              <option value="subscribers">{labels.subscribers}</option>
              <option value="events">{labels.events}</option>
              <option value="calendar">{labels.calendar}</option>
            </select>
          </label>
          {kind !== "guests" || calendars.length ? (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{labels.calendarLabel}</span>
              <select
                className="min-h-11 rounded-lg border border-zinc-300 px-3"
                value={calendarId}
                onChange={(event) => {
                  setCalendarId(event.target.value);
                  setEventId("");
                }}
              >
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {kind === "guests" ? (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{labels.eventLabel}</span>
              <select
                className="min-h-11 rounded-lg border border-zinc-300 px-3"
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
              >
                <option value="">{labels.none}</option>
                {eventChoices.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">{labels.file}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : null}

      {step === 1 && job ? (
        <div className="grid gap-3">
          <h2 className="text-lg font-medium">{labels.detected}</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {job.headers.map((header) => (
              <li key={header} className="rounded-full bg-zinc-100 px-3 py-1">
                {header}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step === 2 && job ? (
        <div className="grid gap-3">
          <p className="text-sm text-zinc-600">{labels.mappingHint}</p>
          {fields.map((field) => (
            <label key={field} className="grid gap-1.5 text-sm">
              <span className="font-medium">
                {labels.fields[field]}
                {required.includes(field) ? " *" : ""}
              </span>
              <select
                className="min-h-11 rounded-lg border border-zinc-300 px-3"
                value={mapping[field] ?? ""}
                onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}
              >
                <option value="">{labels.none}</option>
                {job.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-3">
          <p className="text-sm text-zinc-600">{labels.previewHint}</p>
          {preview.length === 0 ? (
            <p className="text-sm text-zinc-600">{labels.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead>
                  <tr className="border-b border-[#E8E8E8]">
                    <th className="py-2">#</th>
                    {(job?.headers ?? []).map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.row} className="border-b border-zinc-100">
                      <td className="py-2">{row.row}</td>
                      {(job?.headers ?? []).map((header) => (
                        <td key={header}>{row.values[header]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid gap-3">
          <p className="text-sm text-zinc-600">{labels.validationHint}</p>
          <p className="text-sm">
            {labels.errors}: {validation.length}
          </p>
          {validation.length ? (
            <ul className="grid gap-1 text-sm text-red-700">
              {validation.slice(0, 20).map((item) => (
                <li key={`${item.row}-${item.code}-${item.field}`}>
                  {item.row}: {item.code} ({item.field}) {item.email ?? ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {step === 5 ? (
        <p className="text-sm text-zinc-600">{labels.validationHint}</p>
      ) : null}

      {step === 6 && report ? (
        <div className="grid gap-3">
          <p className="text-lg font-medium">
            {labels.imported}: {report.imported} · {labels.skipped}: {report.skipped} · {labels.errors}:{" "}
            {report.errors.length}
          </p>
          {job ? (
            <a
              className="inline-flex min-h-11 items-center text-[13px] font-medium text-zinc-600 transition-opacity hover:opacity-70"
              href={`/api/v1/organizations/${organizationId}/imports/${job.id}/errors.csv`}
            >
              {labels.downloadErrors}
            </a>
          ) : null}
          {report.errors.length ? (
            <ul className="grid gap-1 text-sm text-red-700">
              {report.errors.slice(0, 30).map((item) => (
                <li key={`${item.row}-${item.code}-${item.field}`}>
                  {item.row}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        {step > 0 && step < 6 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)}>
            {labels.back}
          </Button>
        ) : null}
        {step < 6 ? (
          <Button type="button" onClick={() => void goNext()} disabled={pending || (step === 0 && !file)}>
            {step === 0 ? labels.upload : step === 5 ? labels.commit : labels.next}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
