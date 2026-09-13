import { describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, ValidationError } from "@/domain/errors";
import { createCalendarService } from "@/domain/calendar/service";
import { createEventService } from "@/domain/event/service";
import { createChatService } from "@/domain/chat/service";
import { createChatRealtimeHub } from "@/domain/chat/realtime";
import { CHAT_ARCHIVE_AFTER_MS } from "@/domain/chat/types";
import type { ChatActor } from "@/domain/chat/types";
import type { Actor } from "@/domain/rbac/permissions";
import {
  createMemoryCalendars,
  createMemoryChatMessages,
  createMemoryChatModeration,
  createMemoryChatReports,
  createMemoryChatThreads,
  createMemoryChats,
  createMemoryEvents,
  createMemoryRegistrations,
} from "@/test/fakes";

const owner: Actor = {
  userId: "org_owner",
  organizationId: "org_1",
  role: "owner",
  emailVerified: true,
};

const staff: ChatActor = { userId: "org_owner", email: "owner@example.com", membership: owner };
const attendee: ChatActor = { userId: "user_ada", email: "ada@example.com" };
const stranger: ChatActor = { userId: "user_eve", email: "eve@example.com" };

async function setup(now = new Date("2026-09-13T18:00:00.000Z")) {
  const calendars = createMemoryCalendars();
  const events = createMemoryEvents();
  const registrations = createMemoryRegistrations();
  const hub = createChatRealtimeHub();
  const chat = createChatService({
    events,
    calendars,
    registrations,
    chats: createMemoryChats(),
    threads: createMemoryChatThreads(),
    messages: createMemoryChatMessages(),
    reports: createMemoryChatReports(),
    moderation: createMemoryChatModeration(),
    realtime: hub,
    clock: { now: () => now },
  });
  const calendar = await createCalendarService({ calendars }).createCalendar(owner, {
    name: "Chat Lab",
    bannedWords: ["spamword"],
  });
  const eventService = createEventService({ events, calendars });
  const event = await eventService.createEvent(owner, {
    calendarId: calendar.id,
    title: "Town hall",
    startsAt: new Date("2026-09-20T18:00:00.000Z"),
    endsAt: new Date("2026-09-20T20:00:00.000Z"),
    status: "published",
  });
  const other = await eventService.createEvent(owner, {
    calendarId: calendar.id,
    title: "Other",
    startsAt: new Date("2026-09-21T18:00:00.000Z"),
    endsAt: new Date("2026-09-21T20:00:00.000Z"),
    status: "published",
  });
  await registrations.create({
    id: "reg_ada",
    organizationId: "org_1",
    calendarId: calendar.id,
    eventId: event.id,
    userId: attendee.userId,
    email: "ada@example.com",
    status: "confirmed",
    occurrenceStartsAt: null,
    orderId: null,
    ticketTypeId: null,
    quantity: 1,
    offeredUntil: null,
    waitlistPosition: null,
    createdAt: now,
    updatedAt: now,
  });
  return { chat, hub, event, other, calendar, calendars, now };
}

describe("event chat permissions and isolation", () => {
  it("lets registrants post and blocks outsiders", async () => {
    const { chat, event, other } = await setup();
    const posted = await chat.postMessage(attendee, event.id, { body: "Hello room" });
    expect(posted.body).toBe("Hello room");
    expect(posted.authorKind).toBe("user");

    await expect(chat.postMessage(stranger, event.id, { body: "Nope" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(chat.listMessages(attendee, other.id, {})).rejects.toBeInstanceOf(ForbiddenError);
    const page = await chat.listMessages(attendee, event.id, { limit: 20 });
    expect(page.items).toHaveLength(1);
  });

  it("lets staff post as the Organizer account", async () => {
    const { chat, event } = await setup();
    const posted = await chat.postMessage(staff, event.id, {
      body: "Welcome",
      asOrganizer: true,
    });
    expect(posted.authorKind).toBe("organizer");
    await expect(
      chat.postMessage(attendee, event.id, { body: "Hi", asOrganizer: true }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("event chat realtime", () => {
  it("orders messages, dedupes client ids, and replays after reconnect", async () => {
    const { chat, hub, event } = await setup();
    const seen: number[] = [];
    const stop = hub.subscribe(event.id, (item) => {
      seen.push(item.seq);
    });
    const first = await chat.postMessage(attendee, event.id, {
      body: "one",
      clientId: "c1",
    });
    const again = await chat.postMessage(attendee, event.id, {
      body: "one again",
      clientId: "c1",
    });
    expect(again.id).toBe(first.id);
    const second = await chat.postMessage(attendee, event.id, { body: "two", clientId: "c2" });
    expect(second.seq).toBeGreaterThan(first.seq);
    expect(seen).toEqual([first.seq, second.seq]);
    stop();

    const replay = await chat.listMessages(attendee, event.id, { afterSeq: first.seq, limit: 20 });
    expect(replay.items.map((item) => item.seq)).toEqual([second.seq]);
  });
});

describe("event chat moderation", () => {
  it("supports report, soft delete, hard delete, ban and an audit trail", async () => {
    const { chat, event } = await setup();
    const message = await chat.postMessage(attendee, event.id, { body: "Please remove" });
    const report = await chat.reportMessage(attendee, event.id, message.id, "Off topic");
    expect(report.status).toBe("open");
    await expect(
      chat.reportMessage(attendee, event.id, message.id, "Again"),
    ).rejects.toBeInstanceOf(ConflictError);

    const soft = await chat.softDelete(staff, event.id, message.id, "Removed by staff");
    expect(soft.deletedAt).toBeTruthy();
    const attendeeView = await chat.listMessages(attendee, event.id, { limit: 10 });
    expect(attendeeView.items[0]?.body).toBe("");

    const hard = await chat.hardDelete(staff, event.id, message.id, "Purged");
    expect(hard.hardDeletedAt).toBeTruthy();
    expect(hard.body).toBe("");

    await chat.banUser(staff, event.id, attendee.userId, "Repeated spam");
    await expect(chat.postMessage(attendee, event.id, { body: "still here" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const audit = await chat.listAudit(staff, event.id);
    expect(audit.map((item) => item.type)).toEqual(
      expect.arrayContaining(["soft_delete", "hard_delete", "ban"]),
    );
  });

  it("rejects banned words from the calendar list", async () => {
    const { chat, event } = await setup();
    await expect(chat.postMessage(attendee, event.id, { body: "buy spamword now" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("event chat archive", () => {
  it("archives automatically 7 days after the event ends", async () => {
    let now = new Date("2026-09-13T18:00:00.000Z");
    const calendars = createMemoryCalendars();
    const events = createMemoryEvents();
    const registrations = createMemoryRegistrations();
    const chat = createChatService({
      events,
      calendars,
      registrations,
      chats: createMemoryChats(),
      threads: createMemoryChatThreads(),
      messages: createMemoryChatMessages(),
      reports: createMemoryChatReports(),
      moderation: createMemoryChatModeration(),
      clock: { now: () => now },
    });
    const calendar = await createCalendarService({ calendars }).createCalendar(owner, {
      name: "Archive Lab",
    });
    const event = await createEventService({ events, calendars }).createEvent(owner, {
      calendarId: calendar.id,
      title: "Past meetup",
      startsAt: new Date("2026-09-20T18:00:00.000Z"),
      endsAt: new Date("2026-09-20T20:00:00.000Z"),
      status: "published",
    });
    await registrations.create({
      id: "reg_1",
      organizationId: "org_1",
      calendarId: calendar.id,
      eventId: event.id,
      userId: attendee.userId,
      email: "ada@example.com",
      status: "confirmed",
      occurrenceStartsAt: null,
      orderId: null,
      ticketTypeId: null,
      quantity: 1,
      offeredUntil: null,
      waitlistPosition: null,
      createdAt: now,
      updatedAt: now,
    });
    await chat.postMessage(attendee, event.id, { body: "before archive" });
    now = new Date(event.endsAt.getTime() + CHAT_ARCHIVE_AFTER_MS + 1);
    await chat.archiveIfDue(event.id);
    await expect(chat.postMessage(attendee, event.id, { body: "too late" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const history = await chat.listMessages(attendee, event.id, { limit: 10 });
    expect(history.items[0]?.body).toBe("before archive");
  });
});
