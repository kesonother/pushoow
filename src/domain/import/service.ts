import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import type { Calendar, CalendarRepository } from "@/domain/calendar/types";
import type { CalendarWriteInput } from "@/domain/calendar/service";
import type { CalendarSubscription, CalendarSubscriptionRepository } from "@/domain/calendar/follow-types";
import type { RegistrationAttribution } from "@/domain/analytics/types";
import type { EventRegistration, EventRegistrationRepository, TicketTypeRepository } from "@/domain/event/commerce-types";
import type { Event, EventRepository, EventWriteInput } from "@/domain/event/types";
import { toCsv } from "@/domain/analytics/export";
import { parseCsv } from "@/domain/import/csv";
import { encryptImportFile, decryptImportFile } from "@/domain/import/crypto";
import { requiredFields, suggestMapping } from "@/domain/import/detect";
import { importTargetKey, mapGuestStatus, parseTags } from "@/domain/import/status";
import {
  IMPORT_KINDS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_RETENTION_MS,
  type ImportError,
  type ImportJob,
  type ImportKind,
  type ImportMapping,
  type ImportPreviewRow,
  type ImportPublicView,
  type ImportReport,
  type ImportRepository,
} from "@/domain/import/types";
import { mappedValue, parseImportDate, validateRows } from "@/domain/import/validate";
import type { JobType } from "@/jobs/types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";
import { sha256 } from "@/lib/token-crypto";
import { canAccessFullDashboard } from "@/domain/rbac/dashboard";
import { assertPermission, hasPermission, type Actor } from "@/domain/rbac/permissions";
import { assertSameTenant } from "@/domain/tenant/isolation";

export type ImportServiceDeps = {
  imports: ImportRepository;
  calendars: CalendarRepository;
  events: EventRepository;
  registrations: EventRegistrationRepository;
  subscriptions: CalendarSubscriptionRepository;
  tickets: TicketTypeRepository;
  updateCalendar: (actor: Actor, calendarId: string, input: CalendarWriteInput) => Promise<Calendar>;
  createEvent: (
    actor: Actor,
    input: EventWriteInput & { calendarId: string; title: string; startsAt: Date; endsAt: Date },
  ) => Promise<Event>;
  attributions?: { save: (item: RegistrationAttribution) => Promise<unknown> };
  secret: string;
  enqueue?: (input: {
    type: JobType;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    availableAt?: Date;
  }) => Promise<unknown>;
  clock?: Clock;
  ids?: IdGenerator;
};

function omitCiphertext(job: ImportJob): Omit<ImportJob, "ciphertext"> {
  const { ciphertext, ...rest } = job;
  void ciphertext;
  return rest;
}

function assertKind(value: string): ImportKind {
  if (!IMPORT_KINDS.includes(value as ImportKind)) {
    throw new ValidationError("Unsupported import kind", { kind: value });
  }
  return value as ImportKind;
}

function assertImportPermission(actor: Actor, kind: ImportKind) {
  if (!canAccessFullDashboard(actor.role)) {
    throw new ForbiddenError("This role cannot import data");
  }
  if (kind === "guests") {
    assertPermission(actor, "registrants:manage");
    return;
  }
  if (kind === "events") {
    assertPermission(actor, "events:create");
    return;
  }
  if (kind === "calendar") {
    assertPermission(actor, "calendars:update");
    return;
  }
  if (!hasPermission(actor.role, "subscribers:manage") && !hasPermission(actor.role, "calendars:update")) {
    throw new ForbiddenError("Role cannot import subscribers");
  }
}

function errorCsv(errors: ImportError[]): string {
  if (errors.length === 0) return "row,email,field,code,message\n";
  return toCsv(
    errors.map((item) => ({
      row: item.row,
      email: item.email ?? "",
      field: item.field,
      code: item.code,
      message: item.message,
    })),
  );
}

export function createImportService(deps: ImportServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function requireJob(actor: Actor, importId: string): Promise<ImportJob> {
    const job = await deps.imports.findById(importId);
    assertSameTenant(job, actor.organizationId, "Import");
    return job;
  }

  function plaintext(job: ImportJob): string {
    if (job.status === "purged" || !job.ciphertext) {
      throw new NotFoundError("Import file has been deleted");
    }
    return decryptImportFile(job.ciphertext, deps.secret).toString("utf8");
  }

  function parsed(job: ImportJob) {
    return parseCsv(plaintext(job));
  }

  async function requireTargets(actor: Actor, kind: ImportKind, calendarId?: string | null, eventId?: string | null) {
    if (kind === "guests") {
      if (!eventId) throw new ValidationError("An event is required for a guest import");
      const event = await deps.events.findById(eventId);
      assertSameTenant(event, actor.organizationId, "Event");
      if (calendarId && event.calendarId !== calendarId) {
        throw new ValidationError("Event does not belong to this calendar");
      }
      return { calendarId: event.calendarId, eventId: event.id, event, calendar: null as Calendar | null };
    }
    if (!calendarId) throw new ValidationError("A calendar is required for this import");
    const calendar = await deps.calendars.findById(calendarId);
    assertSameTenant(calendar, actor.organizationId, "Calendar");
    return { calendarId: calendar.id, eventId: null as string | null, event: null, calendar };
  }

  async function toPublic(job: ImportJob): Promise<ImportPublicView> {
    if (job.status === "purged" || !job.ciphertext) {
      return {
        ...omitCiphertext(job),
        headers: [],
        sample: [],
        suggestedMapping: {},
        rowCount: 0,
      };
    }
    const { headers, rows } = parsed(job);
    return {
      ...omitCiphertext(job),
      headers,
      sample: rows.slice(0, 8),
      suggestedMapping: Object.keys(job.mapping).length ? job.mapping : suggestMapping(job.kind, headers),
      rowCount: rows.length,
    };
  }

  async function ticketNames(eventId: string | null): Promise<string[] | undefined> {
    if (!eventId) return undefined;
    const tickets = await deps.tickets.listByEvent(eventId);
    return tickets.map((ticket) => ticket.name);
  }

  async function collectErrors(job: ImportJob): Promise<ImportError[]> {
    const { headers, rows } = parsed(job);
    return validateRows({
      kind: job.kind,
      headers,
      rows,
      mapping: job.mapping,
      ticketNames: await ticketNames(job.eventId),
    });
  }

  async function upload(
    actor: Actor,
    input: {
      kind: string;
      calendarId?: string | null;
      eventId?: string | null;
      filename: string;
      csv: string;
    },
  ): Promise<ImportPublicView> {
    const kind = assertKind(input.kind);
    assertImportPermission(actor, kind);
    const csv = input.csv;
    const bytes = Buffer.byteLength(csv, "utf8");
    if (bytes === 0) throw new ValidationError("The CSV file is empty");
    if (bytes > IMPORT_MAX_BYTES) throw new ValidationError("The CSV file is too large");
    const { headers, rows } = parseCsv(csv);
    if (headers.length === 0) throw new ValidationError("The CSV file has no header row");
    if (rows.length > IMPORT_MAX_ROWS) throw new ValidationError("The CSV file has too many rows");
    const targets = await requireTargets(actor, kind, input.calendarId, input.eventId);
    const contentHash = sha256(csv);
    const targetKey = importTargetKey({
      organizationId: actor.organizationId,
      calendarId: targets.calendarId,
      eventId: targets.eventId,
    });
    const existing = await deps.imports.findByHash({
      organizationId: actor.organizationId,
      kind,
      targetKey,
      contentHash,
    });
    if (existing) return toPublic(existing);

    const suggested = suggestMapping(kind, headers);
    const missing = requiredFields(kind).filter((field) => !suggested[field]);
    const now = clock.now();
    const job = await deps.imports.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      kind,
      calendarId: targets.calendarId,
      eventId: targets.eventId,
      targetKey,
      filename: input.filename.trim() || "import.csv",
      contentHash,
      ciphertext: encryptImportFile(Buffer.from(csv, "utf8"), deps.secret),
      byteSize: bytes,
      status: missing.length ? "uploaded" : "mapped",
      mapping: suggested,
      report: null,
      purgeAfter: new Date(now.getTime() + IMPORT_RETENTION_MS),
      purgedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await deps.enqueue?.({
      type: "import.purge",
      payload: { importId: job.id },
      idempotencyKey: `import.purge:${job.id}`,
      availableAt: job.purgeAfter,
    });
    return toPublic(job);
  }

  async function get(actor: Actor, importId: string): Promise<ImportPublicView> {
    const job = await requireJob(actor, importId);
    assertImportPermission(actor, job.kind);
    return toPublic(job);
  }

  async function setMapping(actor: Actor, importId: string, mapping: ImportMapping): Promise<ImportPublicView> {
    const job = await requireJob(actor, importId);
    assertImportPermission(actor, job.kind);
    if (job.status === "committed" || job.status === "purged") {
      throw new ValidationError("This import can no longer be remapped");
    }
    const missing = requiredFields(job.kind).filter((field) => !mapping[field]);
    if (missing.length) {
      throw new ValidationError("Required columns are not mapped", { fields: missing });
    }
    const saved = await deps.imports.save({
      ...job,
      mapping,
      status: "mapped",
      updatedAt: clock.now(),
    });
    return toPublic(saved);
  }

  async function preview(actor: Actor, importId: string): Promise<{ rows: ImportPreviewRow[]; headers: string[] }> {
    const job = await requireJob(actor, importId);
    assertImportPermission(actor, job.kind);
    const { headers, rows } = parsed(job);
    return {
      headers,
      rows: rows.slice(0, 20).map((row, index) => ({
        row: index + 2,
        values: Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""])),
      })),
    };
  }

  async function validate(actor: Actor, importId: string): Promise<{ errors: ImportError[]; rowCount: number }> {
    const job = await requireJob(actor, importId);
    assertImportPermission(actor, job.kind);
    if (!requiredFields(job.kind).every((field) => job.mapping[field])) {
      throw new ValidationError("Map the required columns before validating");
    }
    const { rows } = parsed(job);
    const errors = await collectErrors(job);
    await deps.imports.save({
      ...job,
      status: job.status === "committed" ? "committed" : "validated",
      updatedAt: clock.now(),
    });
    return { errors, rowCount: rows.length };
  }

  async function commitGuests(actor: Actor, job: ImportJob, headers: string[], rows: string[][], blocked: Set<number>) {
    const event = await deps.events.findById(job.eventId!);
    assertSameTenant(event, actor.organizationId, "Event");
    const tickets = await deps.tickets.listByEvent(event.id);
    let imported = 0;
    let skipped = 0;
    for (const [index, row] of rows.entries()) {
      if (blocked.has(index + 2)) continue;
      const email = mappedValue(headers, row, job.mapping, "email").trim().toLowerCase();
      const existing = await deps.registrations.findByEventAndEmail(event.id, email);
      if (existing) {
        skipped += 1;
        continue;
      }
      const ticketName = mappedValue(headers, row, job.mapping, "ticketType");
      const ticket = ticketName
        ? tickets.find((item) => item.name.trim().toLowerCase() === ticketName.toLowerCase())
        : undefined;
      const createdAt = parseImportDate(mappedValue(headers, row, job.mapping, "createdAt")) ?? clock.now();
      const registration: EventRegistration = {
        id: ids.id(),
        organizationId: event.organizationId,
        calendarId: event.calendarId,
        eventId: event.id,
        userId: null,
        email,
        status: mapGuestStatus(mappedValue(headers, row, job.mapping, "status")),
        occurrenceStartsAt: null,
        orderId: null,
        ticketTypeId: ticket?.id ?? null,
        quantity: 1,
        offeredUntil: null,
        waitlistPosition: null,
        anonymous: false,
        appearOnRoster: false,
        createdAt,
        updatedAt: clock.now(),
      };
      const limits = ticket
        ? [{ ticketTypeId: ticket.id, capacity: ticket.capacity, quantity: 1 }]
        : undefined;
      const reserved = await deps.registrations.createIfCapacity(registration, event.capacity, 1, limits);
      if (!reserved.ok) {
        skipped += 1;
        continue;
      }
      await deps.attributions?.save({
        registrationId: reserved.registration.id,
        organizationId: event.organizationId,
        eventId: event.id,
        source: "import",
        tags: [],
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      });
      imported += 1;
    }
    return { imported, skipped };
  }

  async function commitSubscribers(job: ImportJob, headers: string[], rows: string[][], blocked: Set<number>) {
    let imported = 0;
    let skipped = 0;
    for (const [index, row] of rows.entries()) {
      if (blocked.has(index + 2)) continue;
      const email = mappedValue(headers, row, job.mapping, "email").trim().toLowerCase();
      const existing = await deps.subscriptions.findByEmailAndCalendar(email, job.calendarId!);
      if (existing) {
        skipped += 1;
        continue;
      }
      const createdAt = parseImportDate(mappedValue(headers, row, job.mapping, "createdAt")) ?? clock.now();
      const subscription: CalendarSubscription = {
        id: ids.id(),
        organizationId: job.organizationId,
        calendarId: job.calendarId!,
        userId: null,
        email,
        status: "active",
        createdAt,
        updatedAt: clock.now(),
      };
      await deps.subscriptions.create(subscription);
      imported += 1;
    }
    return { imported, skipped };
  }

  async function commitEvents(actor: Actor, job: ImportJob, headers: string[], rows: string[][], blocked: Set<number>) {
    const calendar = await deps.calendars.findById(job.calendarId!);
    assertSameTenant(calendar, actor.organizationId, "Calendar");
    let imported = 0;
    let skipped = 0;
    for (const [index, row] of rows.entries()) {
      if (blocked.has(index + 2)) continue;
      const title = mappedValue(headers, row, job.mapping, "title");
      const startsAt = parseImportDate(mappedValue(headers, row, job.mapping, "startsAt"));
      if (!startsAt) continue;
      const endsAt =
        parseImportDate(mappedValue(headers, row, job.mapping, "endsAt")) ??
        new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
      try {
        await deps.createEvent(actor, {
          calendarId: calendar.id,
          title,
          startsAt,
          endsAt,
          timezone: mappedValue(headers, row, job.mapping, "timezone") || calendar.timezone,
          description: mappedValue(headers, row, job.mapping, "description") || null,
          venueName: mappedValue(headers, row, job.mapping, "venue") || null,
          city: mappedValue(headers, row, job.mapping, "city") || null,
          tags: parseTags(mappedValue(headers, row, job.mapping, "tags")),
          status: "draft",
        });
        imported += 1;
      } catch (error) {
        if (error instanceof ConflictError) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }
    return { imported, skipped };
  }

  async function commitCalendar(actor: Actor, job: ImportJob, headers: string[], rows: string[][], blocked: Set<number>) {
    const row = rows.find((_, index) => !blocked.has(index + 2));
    if (!row) return { imported: 0, skipped: rows.length };
    const title = mappedValue(headers, row, job.mapping, "title");
    const tags = parseTags(mappedValue(headers, row, job.mapping, "tags"));
    await deps.updateCalendar(actor, job.calendarId!, {
      name: title || undefined,
      description: mappedValue(headers, row, job.mapping, "description") || undefined,
      timezone: mappedValue(headers, row, job.mapping, "timezone") || undefined,
      tags: tags.length ? tags : undefined,
      socialLink: mappedValue(headers, row, job.mapping, "website") || undefined,
    });
    return { imported: 1, skipped: Math.max(0, rows.length - 1) };
  }

  async function commit(actor: Actor, importId: string): Promise<ImportReport> {
    const job = await requireJob(actor, importId);
    assertImportPermission(actor, job.kind);
    if (job.status === "committed" && job.report) return job.report;
    if (job.status === "purged") throw new NotFoundError("Import file has been deleted");
    if (!requiredFields(job.kind).every((field) => job.mapping[field])) {
      throw new ValidationError("Map the required columns before importing");
    }
    const { headers, rows } = parsed(job);
    const errors = await collectErrors(job);
    const blocked = new Set(errors.map((item) => item.row));
    let counts = { imported: 0, skipped: 0 };
    if (job.kind === "guests") counts = await commitGuests(actor, job, headers, rows, blocked);
    if (job.kind === "subscribers") counts = await commitSubscribers(job, headers, rows, blocked);
    if (job.kind === "events") counts = await commitEvents(actor, job, headers, rows, blocked);
    if (job.kind === "calendar") counts = await commitCalendar(actor, job, headers, rows, blocked);
    const report: ImportReport = { imported: counts.imported, skipped: counts.skipped, errors };
    await deps.imports.save({
      ...job,
      status: "committed",
      report,
      updatedAt: clock.now(),
    });
    return report;
  }

  async function report(actor: Actor, importId: string): Promise<ImportReport> {
    const job = await requireJob(actor, importId);
    assertImportPermission(actor, job.kind);
    if (!job.report) throw new ValidationError("This import has not been committed yet");
    return job.report;
  }

  async function downloadErrors(actor: Actor, importId: string): Promise<string> {
    const job = await requireJob(actor, importId);
    assertImportPermission(actor, job.kind);
    const errors = job.report?.errors ?? (await collectErrors(job));
    return errorCsv(errors);
  }

  async function purgeExpired(): Promise<number> {
    const now = clock.now();
    const expired = await deps.imports.listExpired(now);
    for (const job of expired) {
      await deps.imports.save({
        ...job,
        ciphertext: "",
        contentHash: `purged:${job.id}`,
        status: "purged",
        purgedAt: now,
        updatedAt: now,
      });
    }
    return expired.length;
  }

  return {
    upload,
    get,
    setMapping,
    preview,
    validate,
    commit,
    report,
    downloadErrors,
    purgeExpired,
  };
}
