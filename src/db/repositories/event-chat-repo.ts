import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  eventChat,
  eventChatMessage,
  eventChatModeration,
  eventChatReport,
  eventChatThread,
} from "@/db/schema";
import type {
  EventChatMessageRepository,
  EventChatModerationRepository,
  EventChatReportRepository,
  EventChatRepository,
  EventChatThreadRepository,
} from "@/domain/chat/types";

export function createDrizzleEventChatRepository(db: Database): EventChatRepository {
  return {
    async create(chat) {
      const [row] = await db.insert(eventChat).values(chat).returning();
      return row;
    },
    async findByEvent(eventId) {
      const [row] = await db.select().from(eventChat).where(eq(eventChat.eventId, eventId)).limit(1);
      return row ?? null;
    },
    async save(chat) {
      const [row] = await db.update(eventChat).set(chat).where(eq(eventChat.id, chat.id)).returning();
      return row;
    },
  };
}

export function createDrizzleEventChatThreadRepository(db: Database): EventChatThreadRepository {
  return {
    async create(thread) {
      const [row] = await db.insert(eventChatThread).values(thread).returning();
      return row;
    },
    async findById(id) {
      const [row] = await db.select().from(eventChatThread).where(eq(eventChatThread.id, id)).limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db
        .select()
        .from(eventChatThread)
        .where(eq(eventChatThread.eventId, eventId))
        .orderBy(asc(eventChatThread.createdAt));
    },
  };
}

export function createDrizzleEventChatMessageRepository(db: Database): EventChatMessageRepository {
  return {
    async create(message) {
      const [row] = await db.insert(eventChatMessage).values(message).returning();
      return row;
    },
    async findById(id) {
      const [row] = await db
        .select()
        .from(eventChatMessage)
        .where(eq(eventChatMessage.id, id))
        .limit(1);
      return row ?? null;
    },
    async findByClientId(chatId, clientId) {
      const [row] = await db
        .select()
        .from(eventChatMessage)
        .where(and(eq(eventChatMessage.chatId, chatId), eq(eventChatMessage.clientId, clientId)))
        .limit(1);
      return row ?? null;
    },
    async listByEvent(eventId, query) {
      const filters = [eq(eventChatMessage.eventId, eventId)];
      if (query.threadId) filters.push(eq(eventChatMessage.threadId, query.threadId));
      if (query.afterSeq != null) filters.push(gt(eventChatMessage.seq, query.afterSeq));
      if (query.beforeSeq != null) filters.push(lt(eventChatMessage.seq, query.beforeSeq));
      return db
        .select()
        .from(eventChatMessage)
        .where(and(...filters))
        .orderBy(query.afterSeq != null ? asc(eventChatMessage.seq) : desc(eventChatMessage.seq))
        .limit(query.limit);
    },
    async save(message) {
      const [row] = await db
        .update(eventChatMessage)
        .set(message)
        .where(eq(eventChatMessage.id, message.id))
        .returning();
      return row;
    },
  };
}

export function createDrizzleEventChatReportRepository(db: Database): EventChatReportRepository {
  return {
    async create(report) {
      const [row] = await db.insert(eventChatReport).values(report).returning();
      return row;
    },
    async findByMessageAndReporter(messageId, reporterUserId) {
      const [row] = await db
        .select()
        .from(eventChatReport)
        .where(
          and(
            eq(eventChatReport.messageId, messageId),
            eq(eventChatReport.reporterUserId, reporterUserId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async listByEvent(eventId) {
      return db.select().from(eventChatReport).where(eq(eventChatReport.eventId, eventId));
    },
    async save(report) {
      const [row] = await db
        .update(eventChatReport)
        .set(report)
        .where(eq(eventChatReport.id, report.id))
        .returning();
      return row;
    },
  };
}

export function createDrizzleEventChatModerationRepository(
  db: Database,
): EventChatModerationRepository {
  return {
    async create(action) {
      const [row] = await db.insert(eventChatModeration).values(action).returning();
      return row;
    },
    async listByEvent(eventId) {
      return db
        .select()
        .from(eventChatModeration)
        .where(eq(eventChatModeration.eventId, eventId));
    },
    async listByUser(eventId, userId) {
      const rows = await db
        .select()
        .from(eventChatModeration)
        .where(eq(eventChatModeration.eventId, eventId));
      return rows.filter((row) => row.targetUserId === userId);
    },
  };
}
