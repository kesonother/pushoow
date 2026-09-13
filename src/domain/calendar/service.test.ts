import { describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import { createCalendarService } from "@/domain/calendar/service";
import type { Actor } from "@/domain/rbac/permissions";
import { createMemoryCalendars, createMemorySlugChanges } from "@/test/fakes";

const owner: Actor = {
  userId: "user_1",
  organizationId: "org_1",
  role: "owner",
};

const outsider: Actor = {
  userId: "user_2",
  organizationId: "org_2",
  role: "owner",
};

describe("calendar service", () => {
  it("creates a calendar in the actor tenant", async () => {
    const svc = createCalendarService({ calendars: createMemoryCalendars() });
    const calendar = await svc.createCalendar(owner, { name: "Community" });
    expect(calendar.organizationId).toBe("org_1");
    expect(calendar.slug).toBe("community");
    expect(calendar.defaultCurrency).toBe("EUR");
    expect(calendar.feedToken).toBeTruthy();
  });

  it("prevents an editor from creating calendars", async () => {
    const svc = createCalendarService({ calendars: createMemoryCalendars() });
    await expect(
      svc.createCalendar({ ...owner, role: "editor" }, { name: "Nope" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("does not leak another tenant calendar by id", async () => {
    const calendars = createMemoryCalendars();
    const svc = createCalendarService({ calendars });
    const calendar = await svc.createCalendar(owner, { name: "Secret" });

    await expect(svc.getCalendar(outsider, calendar.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns not found for unknown calendars", async () => {
    const svc = createCalendarService({ calendars: createMemoryCalendars() });
    await expect(svc.getCalendar(owner, "missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects reserved slugs and slurs", async () => {
    const svc = createCalendarService({ calendars: createMemoryCalendars() });
    await expect(svc.createCalendar(owner, { name: "Admin" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      svc.createCalendar(owner, { name: "Ok", slug: "some-faggot" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces global slug uniqueness", async () => {
    const calendars = createMemoryCalendars();
    const svc = createCalendarService({ calendars });
    await svc.createCalendar(owner, { name: "Paris Tech" });
    await expect(
      svc.createCalendar(outsider, { name: "Other", slug: "paris-tech" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("updates branding and soft-deletes", async () => {
    const calendars = createMemoryCalendars();
    const svc = createCalendarService({ calendars });
    const calendar = await svc.createCalendar(owner, { name: "Studio" });
    const updated = await svc.updateCalendar(owner, calendar.id, {
      primaryColor: "#112233",
      contactEmail: "hello@example.com",
      description: "Weekly meetups",
    });
    expect(updated.primaryColor).toBe("#112233");
    expect(updated.contactEmail).toBe("hello@example.com");

    await svc.deleteCalendar(owner, calendar.id);
    await expect(svc.getCalendar(owner, calendar.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      svc.deleteCalendar({ ...owner, role: "editor" }, calendar.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("limits slug changes to twice per year", async () => {
    const calendars = createMemoryCalendars();
    const slugChanges = createMemorySlugChanges();
    let now = new Date("2026-01-01T00:00:00.000Z");
    const svc = createCalendarService({
      calendars,
      slugChanges,
      clock: { now: () => now },
    });
    const calendar = await svc.createCalendar(owner, { name: "Alpha" });
    await svc.updateCalendar(owner, calendar.id, { slug: "alpha-one" });
    await svc.updateCalendar(owner, calendar.id, { slug: "alpha-two" });
    await expect(svc.updateCalendar(owner, calendar.id, { slug: "alpha-three" })).rejects.toBeInstanceOf(
      ValidationError,
    );

    now = new Date("2027-02-01T00:00:00.000Z");
    const renamed = await svc.updateCalendar(owner, calendar.id, { slug: "alpha-three" });
    expect(renamed.slug).toBe("alpha-three");
  });
});
