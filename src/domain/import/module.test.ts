import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import { memoryAttributions } from "@/domain/analytics/memory";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import { parseCsv } from "@/domain/import/csv";
import { suggestMapping } from "@/domain/import/detect";
import { memoryImports } from "@/domain/import/memory";
import { createImportService } from "@/domain/import/service";
import { IMPORT_RETENTION_MS } from "@/domain/import/types";
import { validateRows } from "@/domain/import/validate";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryCalendars,
  createMemoryEvents,
  createMemoryRegistrations,
  createMemorySubscriptions,
  createMemoryTickets,
} from "@/test/fakes";

const owner: Actor = {
  userId: "user_1",
  organizationId: "org_1",
  role: "owner",
  emailVerified: true,
};

const door: Actor = {
  userId: "door_1",
  organizationId: "org_1",
  role: "check_in_manager",
};

const outsider: Actor = {
  userId: "x",
  organizationId: "org_2",
  role: "owner",
  emailVerified: true,
};

const SECRET = "import-test-secret-32-characters!!";

const lumaGuests = `Email,Name,Ticket Type,Approval Status,Created At
ada@example.com,Ada Lovelace,VIP,Going,2026-01-01T10:00:00.000Z
ada@example.com,Ada Duplicate,VIP,Going,2026-01-02T10:00:00.000Z
not-an-email,Bad Email,VIP,Going,2026-01-03T10:00:00.000Z
,Missing Email,VIP,Going,2026-01-04T10:00:00.000Z
al@example.com,Al Date,VIP,Going,not-a-date
grace@example.com,Grace Hopper,GA,Approved,2026-01-05T10:00:00.000Z
`;

async function setup() {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const registrations = createMemoryRegistrations();
  const subscriptions = createMemorySubscriptions();
  const tickets = createMemoryTickets();
  const attributions = memoryAttributions();
  const calendarService = createCalendarService({ calendars });
  const eventService = createEventService({ events, calendars });
  const calendar = await calendarService.createCalendar(owner, { name: "Luma move" });
  const event = await eventService.createEvent(owner, {
    calendarId: calendar.id,
    title: "Launch night",
    startsAt: new Date("2026-11-01T18:00:00.000Z"),
    endsAt: new Date("2026-11-01T21:00:00.000Z"),
    status: "published",
  });
  await tickets.create({
    id: "t_vip",
    organizationId: owner.organizationId,
    eventId: event.id,
    name: "VIP",
    description: null,
    priceCents: 0,
    currency: "EUR",
    capacity: null,
    salesStart: null,
    salesEnd: null,
    visibility: "public",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  let now = new Date("2026-09-13T12:00:00.000Z");
  const imports = createImportService({
    imports: memoryImports(),
    calendars,
    events,
    registrations,
    subscriptions,
    tickets,
    updateCalendar: (actor, calendarId, input) => calendarService.updateCalendar(actor, calendarId, input),
    createEvent: (actor, input) => eventService.createEvent(actor, input),
    attributions,
    secret: SECRET,
    clock: { now: () => now },
  });
  return {
    imports,
    calendars,
    events,
    registrations,
    subscriptions,
    calendar,
    event,
    attributions,
    setNow: (value: Date) => {
      now = value;
    },
  };
}

describe("import csv", () => {
  it("parses quoted commas", () => {
    const parsed = parseCsv('Title,Description\n"Hello, world","Line ""two"""\n');
    expect(parsed.headers).toEqual(["Title", "Description"]);
    expect(parsed.rows[0]).toEqual(["Hello, world", 'Line "two"']);
  });

  it("detects Luma guest columns", () => {
    const mapping = suggestMapping("guests", ["Email", "Name", "Ticket Type", "Approval Status", "Created At"]);
    expect(mapping.email).toBe("Email");
    expect(mapping.ticketType).toBe("Ticket Type");
    expect(mapping.status).toBe("Approval Status");
  });

  it("flags invalid, duplicate, missing, date, and ticket errors", () => {
    const { headers, rows } = parseCsv(lumaGuests);
    const mapping = suggestMapping("guests", headers);
    const errors = validateRows({ kind: "guests", headers, rows, mapping, ticketNames: ["VIP"] });
    expect(errors.map((item) => item.code).sort()).toEqual([
      "duplicate_email",
      "invalid_date",
      "invalid_email",
      "invalid_ticket_type",
      "missing_required",
    ]);
  });
});

describe("import service", () => {
  it("imports valid guests and is idempotent on the same file", async () => {
    const ctx = await setup();
    const first = await ctx.imports.upload(owner, {
      kind: "guests",
      eventId: ctx.event.id,
      filename: "luma-guests.csv",
      csv: lumaGuests,
    });
    const report = await ctx.imports.commit(owner, first.id);
    expect(report.imported).toBe(1);
    expect(report.skipped).toBe(0);
    expect(report.errors.length).toBeGreaterThan(0);
    const guests = await ctx.registrations.listByEvent(ctx.event.id);
    expect(guests.map((item) => item.email)).toEqual(["ada@example.com"]);
    expect(guests[0]?.ticketTypeId).toBe("t_vip");
    expect(await ctx.attributions.findByRegistration(guests[0]!.id)).toMatchObject({ source: "import" });

    const again = await ctx.imports.upload(owner, {
      kind: "guests",
      eventId: ctx.event.id,
      filename: "luma-guests.csv",
      csv: lumaGuests,
    });
    expect(again.id).toBe(first.id);
    const second = await ctx.imports.commit(owner, again.id);
    expect(second).toEqual(report);
    expect((await ctx.registrations.listByEvent(ctx.event.id)).length).toBe(1);
  });

  it("imports subscribers without duplicating emails", async () => {
    const ctx = await setup();
    const csv = "Email,Name,Subscribed At\nada@example.com,Ada,2026-01-01\n";
    const job = await ctx.imports.upload(owner, {
      kind: "subscribers",
      calendarId: ctx.calendar.id,
      filename: "subs.csv",
      csv,
    });
    const report = await ctx.imports.commit(owner, job.id);
    expect(report.imported).toBe(1);
    await ctx.imports.commit(owner, job.id);
    expect((await ctx.subscriptions.listByCalendar(ctx.calendar.id)).length).toBe(1);
  });

  it("imports events and skips existing slugs", async () => {
    const ctx = await setup();
    const csv = `Title,Start,End,Timezone,Location
Launch night,2026-11-01T18:00:00.000Z,2026-11-01T21:00:00.000Z,Europe/Paris,Paris
New meetup,2026-12-01T18:00:00.000Z,2026-12-01T20:00:00.000Z,Europe/Paris,Lyon
`;
    const job = await ctx.imports.upload(owner, {
      kind: "events",
      calendarId: ctx.calendar.id,
      filename: "events.csv",
      csv,
    });
    const report = await ctx.imports.commit(owner, job.id);
    expect(report.imported).toBe(1);
    expect(report.skipped).toBe(1);
  });

  it("updates calendar metadata", async () => {
    const ctx = await setup();
    const job = await ctx.imports.upload(owner, {
      kind: "calendar",
      calendarId: ctx.calendar.id,
      filename: "calendar.csv",
      csv: "Name,Description,Timezone,Tags,Website\nMigrated,From Luma,Europe/Paris,tech|startup,https://example.com\n",
    });
    const report = await ctx.imports.commit(owner, job.id);
    expect(report.imported).toBe(1);
    const calendar = await ctx.calendars.findById(ctx.calendar.id);
    expect(calendar?.name).toBe("Migrated");
    expect(calendar?.socialLink).toBe("https://example.com");
    expect(calendar?.tags).toEqual(["tech", "startup"]);
  });

  it("blocks door staff and other tenants", async () => {
    const ctx = await setup();
    await expect(
      ctx.imports.upload(door, {
        kind: "guests",
        eventId: ctx.event.id,
        filename: "x.csv",
        csv: "Email\nada@example.com\n",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const job = await ctx.imports.upload(owner, {
      kind: "guests",
      eventId: ctx.event.id,
      filename: "x.csv",
      csv: "Email\nada@example.com\n",
    });
    await expect(ctx.imports.get(outsider, job.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("purges ciphertext after retention while keeping the report", async () => {
    const ctx = await setup();
    const job = await ctx.imports.upload(owner, {
      kind: "guests",
      eventId: ctx.event.id,
      filename: "x.csv",
      csv: "Email\nada@example.com\n",
    });
    await ctx.imports.commit(owner, job.id);
    ctx.setNow(new Date(Date.parse("2026-09-13T12:00:00.000Z") + IMPORT_RETENTION_MS + 1));
    expect(await ctx.imports.purgeExpired()).toBe(1);
    await expect(ctx.imports.preview(owner, job.id)).rejects.toBeInstanceOf(NotFoundError);
    const report = await ctx.imports.report(owner, job.id);
    expect(report.imported).toBe(1);
    const view = await ctx.imports.get(owner, job.id);
    expect(view.status).toBe("purged");
    expect(view.headers).toEqual([]);
  });

  it("rejects a file that is not a usable CSV", async () => {
    const ctx = await setup();
    await expect(
      ctx.imports.upload(owner, {
        kind: "guests",
        eventId: ctx.event.id,
        filename: "empty.csv",
        csv: "",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
