import type { Actor } from "@/domain/rbac/permissions";

export const CHAT_AUTHOR_KINDS = ["user", "organizer"] as const;
export type ChatAuthorKind = (typeof CHAT_AUTHOR_KINDS)[number];

export const CHAT_REPORT_STATUSES = ["open", "reviewed", "dismissed"] as const;
export type ChatReportStatus = (typeof CHAT_REPORT_STATUSES)[number];

export const CHAT_MODERATION_TYPES = [
  "soft_delete",
  "hard_delete",
  "ban",
  "unban",
] as const;
export type ChatModerationType = (typeof CHAT_MODERATION_TYPES)[number];

export const CHAT_ELIGIBLE_STATUSES = ["pending", "confirmed", "offered", "checked_in"] as const;

export const ORGANIZER_ACCOUNT = "Organizer";
export const CHAT_ARCHIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type EventChat = {
  id: string;
  organizationId: string;
  calendarId: string;
  eventId: string;
  nextSeq: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventChatThread = {
  id: string;
  organizationId: string;
  eventId: string;
  chatId: string;
  title: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventChatMessage = {
  id: string;
  organizationId: string;
  eventId: string;
  chatId: string;
  threadId: string;
  parentId: string | null;
  authorUserId: string | null;
  authorKind: ChatAuthorKind;
  body: string;
  clientId: string | null;
  seq: number;
  deletedAt: Date | null;
  hardDeletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventChatReport = {
  id: string;
  organizationId: string;
  eventId: string;
  messageId: string;
  reporterUserId: string;
  reason: string;
  status: ChatReportStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type EventChatModerationAction = {
  id: string;
  organizationId: string;
  eventId: string;
  chatId: string;
  actorUserId: string;
  type: ChatModerationType;
  targetUserId: string | null;
  targetMessageId: string | null;
  reason: string;
  createdAt: Date;
};

export type ChatActor = {
  userId: string;
  email?: string | null;
  membership?: Actor | null;
};

export type ChatRights = {
  read: boolean;
  post: boolean;
  moderate: boolean;
  organizer: boolean;
};

export type EventChatRepository = {
  create: (chat: EventChat) => Promise<EventChat>;
  findByEvent: (eventId: string) => Promise<EventChat | null>;
  save: (chat: EventChat) => Promise<EventChat>;
};

export type EventChatThreadRepository = {
  create: (thread: EventChatThread) => Promise<EventChatThread>;
  findById: (id: string) => Promise<EventChatThread | null>;
  listByEvent: (eventId: string) => Promise<EventChatThread[]>;
};

export type EventChatMessageRepository = {
  create: (message: EventChatMessage) => Promise<EventChatMessage>;
  findById: (id: string) => Promise<EventChatMessage | null>;
  findByClientId: (chatId: string, clientId: string) => Promise<EventChatMessage | null>;
  listByEvent: (
    eventId: string,
    query: { threadId?: string; afterSeq?: number; beforeSeq?: number; limit: number },
  ) => Promise<EventChatMessage[]>;
  save: (message: EventChatMessage) => Promise<EventChatMessage>;
};

export type EventChatReportRepository = {
  create: (report: EventChatReport) => Promise<EventChatReport>;
  findByMessageAndReporter: (
    messageId: string,
    reporterUserId: string,
  ) => Promise<EventChatReport | null>;
  listByEvent: (eventId: string) => Promise<EventChatReport[]>;
  save: (report: EventChatReport) => Promise<EventChatReport>;
};

export type EventChatModerationRepository = {
  create: (action: EventChatModerationAction) => Promise<EventChatModerationAction>;
  listByEvent: (eventId: string) => Promise<EventChatModerationAction[]>;
  listByUser: (eventId: string, userId: string) => Promise<EventChatModerationAction[]>;
};
