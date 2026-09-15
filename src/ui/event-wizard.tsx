"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiMessage, useI18n } from "@/i18n/client";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

const STEPS = ["basics", "location", "registration", "review"] as const;

type Template = { id: string; name: string; description: string };

export function EventWizard({
  organizationId,
  calendarId,
  eventId,
  labels,
  initial,
}: {
  organizationId: string;
  calendarId: string;
  eventId?: string;
  labels: Record<string, string>;
  initial?: Partial<{
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    templateId: string;
    tags: string;
    locationKind: string;
    registrationMode: string;
    capacity: string;
  }>;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<(typeof STEPS)[number]>("basics");
  const [id, setId] = useState(eventId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [persona, setPersona] = useState<"neutral" | "casual" | "corporate" | "academic">("neutral");
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [geo, setGeo] = useState<
    Array<{
      address: string;
      latitude: number;
      longitude: number;
      timezone?: string | null;
      city?: string | null;
      country?: string | null;
    }>
  >([]);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    startsAt: initial?.startsAt ?? "",
    endsAt: initial?.endsAt ?? "",
    timezone: "Europe/Paris",
    templateId: initial?.templateId ?? "",
    locationKind: initial?.locationKind ?? "physical",
    venueName: "",
    venueAddress: "",
    virtualUrl: "",
    virtualProvider: "",
    customPinLabel: "",
    coverImageUrl: "",
    latitude: "",
    longitude: "",
    registrationMode: initial?.registrationMode ?? "open_rsvp",
    rosterMode: "hidden",
    registrationPassword: "",
    allowedEmailDomains: "",
    accessToken: "",
    capacity: initial?.capacity ?? "",
    waitlistEnabled: true,
    waitlistDuringPresale: false,
    isPaid: false,
    city: "",
    country: "",
    category: "",
    language: "",
    tags: initial?.tags ?? "",
  });

  useEffect(() => {
    fetch("/api/v1/event-templates")
      .then((response) => response.json())
      .then((payload) => setTemplates(payload.data ?? []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/v1/events/${eventId}`)
      .then((response) => response.json())
      .then((payload) => {
        const event = payload.data;
        if (!event) return;
        setId(event.id);
        setForm((current) => ({
          ...current,
          title: event.title ?? "",
          description: event.description ?? "",
          startsAt: event.startsAt ? toLocalInput(new Date(event.startsAt)) : "",
          endsAt: event.endsAt ? toLocalInput(new Date(event.endsAt)) : "",
          timezone: event.timezone ?? current.timezone,
          templateId: event.templateId ?? "",
          locationKind: event.locationKind ?? "physical",
          venueName: event.venueName ?? "",
          venueAddress: event.venueAddress ?? "",
          virtualUrl: event.virtualUrl ?? "",
          virtualProvider: event.virtualProvider ?? "",
          customPinLabel: event.customPinLabel ?? "",
          coverImageUrl: event.coverImageUrl ?? "",
          latitude: event.latitude != null ? String(event.latitude) : "",
          longitude: event.longitude != null ? String(event.longitude) : "",
          registrationMode: event.registrationMode ?? "open_rsvp",
          rosterMode: event.rosterMode ?? "hidden",
          allowedEmailDomains: (event.allowedEmailDomains ?? []).join(", "),
          capacity: event.capacity != null ? String(event.capacity) : "",
          waitlistEnabled: event.waitlistEnabled ?? true,
          waitlistDuringPresale: event.waitlistDuringPresale ?? false,
          isPaid: event.isPaid ?? false,
          city: event.city ?? "",
          country: event.country ?? "",
          category: event.category ?? "",
          language: event.language ?? "",
          tags: (event.tags ?? []).join(", "),
        }));
      })
      .catch(() => undefined);
  }, [eventId]);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function generateDescription() {
    setError(null);
    setAiHint(null);
    const format =
      form.locationKind === "virtual" ? "online" : form.locationKind === "hybrid" ? "hybrid" : "in-person";
    const location = [form.city, form.venueName, form.venueAddress].filter(Boolean).join(", ") || null;
    const response = await fetch(`/api/v1/organizations/${organizationId}/ai/descriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
        location,
        format,
        persona,
      }),
    });
    if (!response.ok) {
      setError(labels.aiGenerated);
      return;
    }
    const payload = await response.json();
    const markdown = String(payload.data?.markdown ?? "");
    if (markdown) patch("description", markdown);
    setAiHint(labels.aiGenerated);
  }

  async function save(nextStep = step, publish = false) {
    setError(null);
    const response = await fetch(`/api/v1/calendars/${calendarId}/events/wizard`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        step: nextStep,
        eventId: id || undefined,
        title: form.title,
        description: form.description || null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        timezone: form.timezone,
        templateId: form.templateId || null,
        locationKind: form.locationKind,
        venueName: form.venueName || null,
        venueAddress: form.venueAddress || null,
        virtualUrl: form.virtualUrl || null,
        virtualProvider: form.virtualProvider || null,
        customPinLabel: form.customPinLabel || null,
        coverImageUrl: form.coverImageUrl || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        registrationMode: form.registrationMode,
        rosterMode: form.rosterMode,
        registrationPassword: form.registrationPassword || null,
        allowedEmailDomains: form.allowedEmailDomains
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        accessToken: form.accessToken || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        waitlistEnabled: form.waitlistEnabled,
        waitlistDuringPresale: form.waitlistDuringPresale,
        isPaid: form.isPaid,
        city: form.city || null,
        country: form.country || null,
        category: form.category || null,
        language: form.language || null,
        tags: form.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        status: publish ? "scheduled" : "draft",
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(apiMessage(payload, t.errors.unableToSave));
      return null;
    }
    setId(payload.data.id);
    return payload.data;
  }

  async function searchGeo() {
    if (form.venueAddress.length < 3) return;
    const response = await fetch(`/api/v1/geo/search?q=${encodeURIComponent(form.venueAddress)}`);
    const payload = await response.json();
    setGeo(payload.data ?? []);
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const index = STEPS.indexOf(step);
        if (step !== "review") {
          const saved = await save(step);
          if (saved) setStep(STEPS[index + 1]);
          return;
        }
        const saved = await save("review", true);
        if (saved) router.push(`/e/${saved.slug}?onboarding=share`);
      }}
    >
      <ol className="grid grid-cols-4 gap-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-600">
        {STEPS.map((item) => (
          <li key={item} className={item === step ? "text-zinc-950" : ""}>
            {labels[item]}
          </li>
        ))}
      </ol>

      {step === "basics" ? (
        <div className="grid gap-4">
          <Input label={labels.title} value={form.title} onChange={(e) => patch("title", e.target.value)} required />
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {labels.template}
            <select
              className="min-h-11 rounded-lg border border-zinc-300 px-3"
              value={form.templateId}
              onChange={(e) => patch("templateId", e.target.value)}
            >
              <option value="">{labels.noTemplate}</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {labels.description}
            <textarea
              className="min-h-32 rounded-lg border border-zinc-300 px-3 py-2"
              value={form.description}
              onChange={(e) => patch("description", e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {labels.persona}
              <select
                className="min-h-11 rounded-lg border border-zinc-300 px-3"
                value={persona}
                onChange={(e) => setPersona(e.target.value as typeof persona)}
              >
                <option value="neutral">{labels.personaNeutral}</option>
                <option value="casual">{labels.personaCasual}</option>
                <option value="corporate">{labels.personaCorporate}</option>
                <option value="academic">{labels.personaAcademic}</option>
              </select>
            </label>
            <Button type="button" variant="secondary" onClick={() => generateDescription()} disabled={!form.title}>
              {labels.generateDescription}
            </Button>
          </div>
          {aiHint ? <p className="text-sm text-zinc-600">{aiHint}</p> : null}
          <Input label={labels.startsAt} type="datetime-local" value={form.startsAt} onChange={(e) => patch("startsAt", e.target.value)} />
          <Input label={labels.endsAt} type="datetime-local" value={form.endsAt} onChange={(e) => patch("endsAt", e.target.value)} />
          <Input label={labels.timezone} value={form.timezone} onChange={(e) => patch("timezone", e.target.value)} />
          <Input label={labels.cover} value={form.coverImageUrl} onChange={(e) => patch("coverImageUrl", e.target.value)} />
          <Input label={labels.category} value={form.category} onChange={(e) => patch("category", e.target.value)} />
          <Input label={labels.language} value={form.language} onChange={(e) => patch("language", e.target.value)} />
          <Input label={labels.tags} value={form.tags} onChange={(e) => patch("tags", e.target.value)} />
        </div>
      ) : null}

      {step === "location" ? (
        <div className="grid gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {labels.locationKind}
            <select
              className="min-h-11 rounded-lg border border-zinc-300 px-3"
              value={form.locationKind}
              onChange={(e) => patch("locationKind", e.target.value)}
            >
              <option value="physical">{labels.locationPhysical}</option>
              <option value="virtual">{labels.locationVirtual}</option>
              <option value="hybrid">{labels.locationHybrid}</option>
            </select>
          </label>
          {form.locationKind !== "virtual" ? (
            <>
              <Input label={labels.venueName} value={form.venueName} onChange={(e) => patch("venueName", e.target.value)} />
              <Input label={labels.venueAddress} value={form.venueAddress} onChange={(e) => patch("venueAddress", e.target.value)} />
              <Input label={labels.city} value={form.city} onChange={(e) => patch("city", e.target.value)} />
              <Input label={labels.country} value={form.country} onChange={(e) => patch("country", e.target.value)} />
              <Button type="button" variant="secondary" onClick={searchGeo}>
                {labels.geocode}
              </Button>
              {geo.map((item) => (
                <button
                  key={`${item.latitude}-${item.longitude}`}
                  type="button"
                  className="rounded-lg border border-[#E8E8E8] px-3 py-2 text-start text-sm"
                  onClick={() => {
                    patch("venueAddress", item.address);
                    patch("latitude", String(item.latitude));
                    patch("longitude", String(item.longitude));
                    if (item.timezone) patch("timezone", item.timezone);
                    if (item.city) patch("city", item.city);
                    if (item.country) patch("country", item.country);
                  }}
                >
                  {item.address}
                </button>
              ))}
            </>
          ) : null}
          {form.locationKind !== "virtual" ? (
            <Input label={labels.customPin} value={form.customPinLabel} onChange={(e) => patch("customPinLabel", e.target.value)} />
          ) : null}
          {form.locationKind !== "physical" ? (
            <>
              <Input label={labels.virtualUrl} value={form.virtualUrl} onChange={(e) => patch("virtualUrl", e.target.value)} />
              <Input
                label={labels.virtualProvider}
                value={form.virtualProvider}
                onChange={(e) => patch("virtualProvider", e.target.value)}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {step === "registration" ? (
        <div className="grid gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {labels.registrationMode}
            <select
              className="min-h-11 rounded-lg border border-zinc-300 px-3"
              value={form.registrationMode}
              onChange={(e) => patch("registrationMode", e.target.value)}
            >
              <option value="open_rsvp">{labels.modeOpenRsvp}</option>
              <option value="approval">{labels.modeApproval}</option>
              <option value="invitation">{labels.modeInvitation}</option>
              <option value="password">{labels.modePassword}</option>
              <option value="email_domain">{labels.modeEmailDomain}</option>
              <option value="token">{labels.modeToken}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {labels.rosterMode}
            <select
              className="min-h-11 rounded-lg border border-zinc-300 px-3"
              value={form.rosterMode}
              onChange={(e) => patch("rosterMode", e.target.value)}
            >
              <option value="hidden">{labels.rosterHiddenOption}</option>
              <option value="visible">{labels.rosterVisibleOption}</option>
              <option value="anonymized">{labels.rosterAnonymizedOption}</option>
              <option value="approval_only">{labels.rosterApprovalOnlyOption}</option>
            </select>
          </label>
          {form.registrationMode === "password" ? (
            <Input
              label={labels.registrationPassword}
              type="password"
              value={form.registrationPassword}
              onChange={(e) => patch("registrationPassword", e.target.value)}
            />
          ) : null}
          {form.registrationMode === "email_domain" ? (
            <Input
              label={labels.allowedDomains}
              value={form.allowedEmailDomains}
              onChange={(e) => patch("allowedEmailDomains", e.target.value)}
            />
          ) : null}
          {form.registrationMode === "token" ? (
            <Input label={labels.accessToken} value={form.accessToken} onChange={(e) => patch("accessToken", e.target.value)} />
          ) : null}
          <Input label={labels.capacity} type="number" value={form.capacity} onChange={(e) => patch("capacity", e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.waitlistEnabled} onChange={(e) => patch("waitlistEnabled", e.target.checked)} />
            {labels.waitlist}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.waitlistDuringPresale}
              onChange={(e) => patch("waitlistDuringPresale", e.target.checked)}
            />
            {labels.waitlistPresale}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPaid} onChange={(e) => patch("isPaid", e.target.checked)} />
            {labels.paid}
          </label>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="grid gap-2 text-sm text-zinc-700">
          <p><strong>{form.title}</strong></p>
          <p>{form.startsAt} → {form.endsAt} ({form.timezone})</p>
          <p>{form.locationKind}: {form.venueAddress || form.virtualUrl}</p>
          <p>{labels.registrationMode}: {form.registrationMode}</p>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        {step !== "basics" ? (
          <Button type="button" variant="secondary" onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1])}>
            {labels.back}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={() => save(step)}>
          {labels.saveDraft}
        </Button>
        <Button type="submit">{step === "review" ? labels.publish : labels.next}</Button>
      </div>
      {id ? (
        <p className="text-xs text-zinc-600">
          {labels.resume} {organizationId}/{id}
        </p>
      ) : null}
    </form>
  );
}

function toLocalInput(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
