import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import { assertAllowedBody } from "@/domain/chat/banned-words";
import { resolveChatRights } from "@/domain/chat/permissions";
import type { ChatRealtimeHub } from "@/domain/chat/realtime";
import {
  CHAT_ARCHIVE_AFTER_MS,
  ORGANIZER_ACCOUNT,
  type ChatActor,
  type ChatRights,
  type EventChat,
  type EventChatMessage,
  type EventChatModerationAction,
  type EventChatModerationRepository,
  type EventChatReportRepository,
  type EventChatRepository,
  type EventChatThread,
  type EventChatThreadRepository,
  type EventChatMessageRepository,
} from "@/domain/chat/types";
import type { Calendar, CalendarRepository } from "@/domain/calendar/types";
import type { Event, EventRepository } from "@/domain/event/types";
import type { EventRegistration, EventRegistrationRepository } from "@/domain/event/commerce-types";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export type ChatArchiveScheduler = {
  scheduleArchive: (input: { eventId: string; availableAt: Date }) => Promise<void>;
};

export type ChatServiceDeps = {
  events: EventRepository;
  calendars: CalendarRepository;
  registrations: EventRegistrationRepository;
  chats: EventChatRepository;
  threads: EventChatThreadRepository;
  messages: EventChatMessageRepository;
  reports: EventChatReportRepository;
  moderation: EventChatModerationRepository;
  realtime?: ChatRealtimeHub;
  schedule?: ChatArchiveScheduler;
  clock?: Clock;
  ids?: IdGenerator;
};

const GENERAL_THREAD = "General";

export function archiveDueAt(event: Event): Date {
  return new Date(event.endsAt.getTime() + CHAT_ARCHIVE_AFTER_MS);
}

export function createChatService(deps: ChatServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;

  async function requireEvent(eventId: string): Promise<Event> {
    const event = await deps.events.findById(eventId);
    if (!event || event.deletedAt) throw new NotFoundError("Event", eventId);
    return event;
  }

  async function findRegistration(eventId: string, actor: ChatActor): Promise<EventRegistration | null> {
    const byUser = await deps.registrations.findByEventAndUser(eventId, actor.userId);
    if (byUser) return byUser;
    if (!actor.email) return null;
    return deps.registrations.findByEventAndEmail(eventId, actor.email.trim().toLowerCase());
  }

  async function isBanned(eventId: string, userId: string): Promise<boolean> {
    const actions = await deps.moderation.listByUser(eventId, userId);
    const last = [...actions]
      .filter((item) => item.type === "ban" || item.type === "unban")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .at(-1);
    return last?.type === "ban";
  }

  async function rightsFor(event: Event, actor: ChatActor, chat: EventChat | null): Promise<ChatRights> {
    const [registration, banned] = await Promise.all([
      findRegistration(event.id, actor),
      isBanned(event.id, actor.userId),
    ]);
    const archived = Boolean(chat?.archivedAt) || clock.now() >= archiveDueAt(event);
    return resolveChatRights({ actor, registration, banned, archived });
  }

  async function assertRead(event: Event, actor: ChatActor, chat: EventChat | null) {
    const rights = await rightsFor(event, actor, chat);
    if (!rights.read) {
      throw new ForbiddenError("You cannot access this event chat");
    }
    return rights;
  }

  async function ensureChat(event: Event): Promise<EventChat> {
    const existing = await deps.chats.findByEvent(event.id);
    if (existing) {
      if (!existing.archivedAt && clock.now() >= archiveDueAt(event)) {
        return archiveChat(existing);
      }
      return existing;
    }
    const now = clock.now();
    const chat = await deps.chats.create({
      id: ids.id(),
      organizationId: event.organizationId,
      calendarId: event.calendarId,
      eventId: event.id,
      nextSeq: 0,
      archivedAt: now >= archiveDueAt(event) ? now : null,
      createdAt: now,
      updatedAt: now,
    });
    await deps.threads.create({
      id: ids.id(),
      organizationId: event.organizationId,
      eventId: event.id,
      chatId: chat.id,
      title: GENERAL_THREAD,
      createdByUserId: null,
      createdAt: now,
      updatedAt: now,
    });
    await deps.schedule?.scheduleArchive({
      eventId: event.id,
      availableAt: archiveDueAt(event),
    });
    return chat;
  }

  async function archiveChat(chat: EventChat): Promise<EventChat> {
    if (chat.archivedAt) return chat;
    const now = clock.now();
    const archived = await deps.chats.save({
      ...chat,
      archivedAt: now,
      updatedAt: now,
    });
    deps.realtime?.publish({
      id: `archive:${archived.id}`,
      eventId: archived.eventId,
      seq: archived.nextSeq,
      type: "archived",
      payload: { archivedAt: now.toISOString() },
    });
    return archived;
  }

  async function getAccess(actor: ChatActor, eventId: string) {
    const event = await requireEvent(eventId);
    const chat = await ensureChat(event);
    const rights = await assertRead(event, actor, chat);
    return { event, chat, rights };
  }

  async function defaultThread(eventId: string): Promise<EventChatThread> {
    const threads = await deps.threads.listByEvent(eventId);
    const general = threads.find((item) => item.title === GENERAL_THREAD) ?? threads[0];
    if (!general) throw new NotFoundError("EventChatThread");
    return general;
  }

  function presentMessage(message: EventChatMessage, rights: ChatRights): EventChatMessage {
    if (message.hardDeletedAt) {
      return { ...message, body: "" };
    }
    if (message.deletedAt && !rights.moderate) {
      return { ...message, body: "" };
    }
    return message;
  }

  async function listMessages(
    actor: ChatActor,
    eventId: string,
    query: { threadId?: string; beforeSeq?: number; afterSeq?: number; limit?: number },
  ) {
    const { rights } = await getAccess(actor, eventId);
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
    const rows = await deps.messages.listByEvent(eventId, {
      threadId: query.threadId,
      beforeSeq: query.beforeSeq,
      afterSeq: query.afterSeq,
      limit,
    });
    const presented = rows.map((item) => presentMessage(item, rights));
    const oldest = presented.at(-1);
    return {
      items: presented,
      nextCursor: oldest && presented.length === limit ? String(oldest.seq) : null,
    };
  }

  async function listThreads(actor: ChatActor, eventId: string) {
    await getAccess(actor, eventId);
    return deps.threads.listByEvent(eventId);
  }

  async function createThread(actor: ChatActor, eventId: string, title: string) {
    const { event, chat, rights } = await getAccess(actor, eventId);
    if (!rights.post) throw new ForbiddenError("You cannot post in this event chat");
    const trimmed = title.trim();
    if (trimmed.length < 2) throw new ValidationError("A thread title is required");
    const now = clock.now();
    return deps.threads.create({
      id: ids.id(),
      organizationId: event.organizationId,
      eventId: event.id,
      chatId: chat.id,
      title: trimmed.slice(0, 120),
      createdByUserId: actor.userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function postMessage(
    actor: ChatActor,
    eventId: string,
    input: {
      body: string;
      threadId?: string;
      parentId?: string | null;
      clientId?: string;
      asOrganizer?: boolean;
    },
  ): Promise<EventChatMessage> {
    const { event, chat, rights } = await getAccess(actor, eventId);
    if (!rights.post) throw new ForbiddenError("You cannot post in this event chat");
    if (input.asOrganizer && !rights.organizer) {
      throw new ForbiddenError("Only organizers can post as Organizer");
    }
    const body = input.body.trim();
    if (body.length < 1 || body.length > 4000) {
      throw new ValidationError("Message body must be between 1 and 4000 characters");
    }
    const calendar = (await deps.calendars.findById(event.calendarId)) as Calendar | null;
    assertAllowedBody(body, calendar?.bannedWords ?? []);

    if (input.clientId) {
      const duplicate = await deps.messages.findByClientId(chat.id, input.clientId);
      if (duplicate) return presentMessage(duplicate, rights);
    }

    let threadId = input.threadId;
    if (threadId) {
      const thread = await deps.threads.findById(threadId);
      if (!thread || thread.eventId !== event.id) throw new NotFoundError("EventChatThread", threadId);
    } else {
      threadId = (await defaultThread(event.id)).id;
    }

    if (input.parentId) {
      const parent = await deps.messages.findById(input.parentId);
      if (!parent || parent.eventId !== event.id || parent.threadId !== threadId) {
        throw new ValidationError("Reply must target a message in the same thread");
      }
    }

    const now = clock.now();
    const nextSeq = chat.nextSeq + 1;
    await deps.chats.save({ ...chat, nextSeq, updatedAt: now });
    const message = await deps.messages.create({
      id: ids.id(),
      organizationId: event.organizationId,
      eventId: event.id,
      chatId: chat.id,
      threadId,
      parentId: input.parentId ?? null,
      authorUserId: actor.userId,
      authorKind: input.asOrganizer ? "organizer" : "user",
      body,
      clientId: input.clientId ?? null,
      seq: nextSeq,
      deletedAt: null,
      hardDeletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    deps.realtime?.publish({
      id: message.id,
      eventId: event.id,
      seq: message.seq,
      type: "message",
      payload: presentMessage(message, rights),
    });
    return message;
  }

  async function recordModeration(
    actor: ChatActor,
    event: Event,
    chat: EventChat,
    input: {
      type: EventChatModerationAction["type"];
      reason: string;
      targetUserId?: string | null;
      targetMessageId?: string | null;
    },
  ) {
    const reason = input.reason.trim();
    if (reason.length < 3) throw new ValidationError("A moderation reason is required");
    return deps.moderation.create({
      id: ids.id(),
      organizationId: event.organizationId,
      eventId: event.id,
      chatId: chat.id,
      actorUserId: actor.userId,
      type: input.type,
      targetUserId: input.targetUserId ?? null,
      targetMessageId: input.targetMessageId ?? null,
      reason,
      createdAt: clock.now(),
    });
  }

  async function softDelete(actor: ChatActor, eventId: string, messageId: string, reason = "Removed") {
    const { event, chat, rights } = await getAccess(actor, eventId);
    const message = await deps.messages.findById(messageId);
    if (!message || message.eventId !== eventId) throw new NotFoundError("EventChatMessage", messageId);
    const own = message.authorUserId === actor.userId;
    if (!own && !rights.moderate) {
      throw new ForbiddenError("You cannot delete this message");
    }
    if (message.hardDeletedAt) throw new ConflictError("This message is already removed");
    const now = clock.now();
    const updated = await deps.messages.save({
      ...message,
      deletedAt: now,
      updatedAt: now,
    });
    if (rights.moderate && !own) {
      await recordModeration(actor, event, chat, {
        type: "soft_delete",
        reason,
        targetMessageId: message.id,
        targetUserId: message.authorUserId,
      });
    }
    deps.realtime?.publish({
      id: `del:${updated.id}`,
      eventId,
      seq: updated.seq,
      type: "deleted",
      payload: presentMessage(updated, rights),
    });
    return presentMessage(updated, rights);
  }

  async function hardDelete(actor: ChatActor, eventId: string, messageId: string, reason: string) {
    const { event, chat, rights } = await getAccess(actor, eventId);
    if (!rights.moderate) throw new ForbiddenError("You cannot hard-delete messages");
    const message = await deps.messages.findById(messageId);
    if (!message || message.eventId !== eventId) throw new NotFoundError("EventChatMessage", messageId);
    const now = clock.now();
    const updated = await deps.messages.save({
      ...message,
      body: "",
      deletedAt: message.deletedAt ?? now,
      hardDeletedAt: now,
      updatedAt: now,
    });
    await recordModeration(actor, event, chat, {
      type: "hard_delete",
      reason,
      targetMessageId: message.id,
      targetUserId: message.authorUserId,
    });
    deps.realtime?.publish({
      id: `hard:${updated.id}`,
      eventId,
      seq: updated.seq,
      type: "deleted",
      payload: presentMessage(updated, rights),
    });
    return presentMessage(updated, rights);
  }

  async function reportMessage(actor: ChatActor, eventId: string, messageId: string, reason: string) {
    const { event } = await getAccess(actor, eventId);
    const message = await deps.messages.findById(messageId);
    if (!message || message.eventId !== eventId) throw new NotFoundError("EventChatMessage", messageId);
    const trimmed = reason.trim();
    if (trimmed.length < 3) throw new ValidationError("A report reason is required");
    const existing = await deps.reports.findByMessageAndReporter(messageId, actor.userId);
    if (existing) throw new ConflictError("You already reported this message");
    const now = clock.now();
    return deps.reports.create({
      id: ids.id(),
      organizationId: event.organizationId,
      eventId: event.id,
      messageId,
      reporterUserId: actor.userId,
      reason: trimmed.slice(0, 500),
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
  }

  async function listReports(actor: ChatActor, eventId: string) {
    const { rights } = await getAccess(actor, eventId);
    if (!rights.moderate) throw new ForbiddenError("You cannot review chat reports");
    return deps.reports.listByEvent(eventId);
  }

  async function banUser(actor: ChatActor, eventId: string, targetUserId: string, reason: string) {
    const { event, chat, rights } = await getAccess(actor, eventId);
    if (!rights.moderate) throw new ForbiddenError("You cannot ban chat users");
    if (targetUserId === actor.userId) throw new ValidationError("You cannot ban yourself");
    return recordModeration(actor, event, chat, {
      type: "ban",
      reason,
      targetUserId,
    });
  }

  async function unbanUser(actor: ChatActor, eventId: string, targetUserId: string, reason: string) {
    const { event, chat, rights } = await getAccess(actor, eventId);
    if (!rights.moderate) throw new ForbiddenError("You cannot unban chat users");
    return recordModeration(actor, event, chat, {
      type: "unban",
      reason,
      targetUserId,
    });
  }

  async function listAudit(actor: ChatActor, eventId: string) {
    const { rights } = await getAccess(actor, eventId);
    if (!rights.moderate) throw new ForbiddenError("You cannot read the chat audit trail");
    return deps.moderation.listByEvent(eventId);
  }

  async function archiveIfDue(eventId: string): Promise<EventChat | null> {
    const event = await requireEvent(eventId);
    if (clock.now() < archiveDueAt(event)) return deps.chats.findByEvent(eventId);
    const chat = await ensureChat(event);
    return archiveChat(chat);
  }

  return {
    getAccess,
    listMessages,
    listThreads,
    createThread,
    postMessage,
    softDelete,
    hardDelete,
    reportMessage,
    listReports,
    banUser,
    unbanUser,
    listAudit,
    archiveIfDue,
    organizerLabel: ORGANIZER_ACCOUNT,
  };
}
