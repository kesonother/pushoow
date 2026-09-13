import type {
  CalendarFollower,
  CalendarFollowerRepository,
  CalendarSubscription,
  CalendarSubscriptionRepository,
} from "@/domain/calendar/follow-types";
import type {
  CalendarMember,
  CalendarMemberRepository,
  CalendarMembershipTier,
  CalendarMembershipTierRepository,
} from "@/domain/calendar/membership-types";
import type {
  Calendar,
  CalendarRepository,
  CalendarSlugChange,
  CalendarSlugChangeRepository,
} from "@/domain/calendar/types";
import type {
  AddOn,
  AddOnRepository,
  Coupon,
  CouponRepository,
  EventContent,
  EventContentRepository,
  EventOrder,
  EventOrderItem,
  EventRegistration,
  EventRegistrationRepository,
  OrderRepository,
  TicketType,
  TicketTypeRepository,
} from "@/domain/event/commerce-types";
import type {
  OccurrenceOverride,
  OccurrenceOverrideRepository,
  RecurrenceRule,
  RecurrenceRuleRepository,
} from "@/domain/event/recurrence";
import type {
  EventChat,
  EventChatMessage,
  EventChatModerationAction,
  EventChatModerationRepository,
  EventChatReport,
  EventChatReportRepository,
  EventChatRepository,
  EventChatThread,
  EventChatThreadRepository,
  EventChatMessageRepository,
} from "@/domain/chat/types";
import type { Event, EventListQuery, EventRepository } from "@/domain/event/types";
import type {
  MembershipRepository,
  Organization,
  OrganizationMember,
  OrganizationRepository,
} from "@/domain/organization/types";

export function createMemoryOrganizations(): OrganizationRepository {
  const items = new Map<string, Organization>();

  return {
    async create(organization) {
      items.set(organization.id, organization);
      return organization;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findBySlug(slug) {
      return [...items.values()].find((item) => item.slug === slug) ?? null;
    },
    async listByIds(ids) {
      return ids.flatMap((id) => {
        const item = items.get(id);
        return item ? [item] : [];
      });
    },
    async update(organization) {
      items.set(organization.id, organization);
      return organization;
    },
  };
}

export function createMemoryMembers(): MembershipRepository {
  const items = new Map<string, OrganizationMember>();

  return {
    async create(member) {
      items.set(member.id, member);
      return member;
    },
    async findByUserAndOrganization(userId, organizationId) {
      return (
        [...items.values()].find(
          (item) => item.userId === userId && item.organizationId === organizationId,
        ) ?? null
      );
    },
    async listByUser(userId) {
      return [...items.values()].filter((item) => item.userId === userId);
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
    async update(member) {
      items.set(member.id, member);
      return member;
    },
    async delete(id) {
      items.delete(id);
    },
  };
}

export function createMemoryCalendars(): CalendarRepository {
  const items = new Map<string, Calendar>();

  return {
    async create(calendar) {
      items.set(calendar.id, calendar);
      return calendar;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findBySlug(slug) {
      return [...items.values()].find((item) => item.slug === slug) ?? null;
    },
    async findByOrganizationAndSlug(organizationId, slug) {
      return (
        [...items.values()].find(
          (item) => item.organizationId === organizationId && item.slug === slug,
        ) ?? null
      );
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
    async listPublic(excludeId?: string) {
      return [...items.values()].filter(
        (item) => item.visibility === "public" && !item.deletedAt && item.id !== excludeId,
      );
    },
    async update(calendar) {
      items.set(calendar.id, calendar);
      return calendar;
    },
  };
}

export function createMemorySlugChanges(): CalendarSlugChangeRepository {
  const items: CalendarSlugChange[] = [];
  return {
    async create(change) {
      items.push(change);
      return change;
    },
    async countSince(calendarId, since) {
      return items.filter((item) => item.calendarId === calendarId && item.changedAt >= since).length;
    },
  };
}

export function createMemoryFollowers(): CalendarFollowerRepository {
  const items = new Map<string, CalendarFollower>();
  return {
    async create(follower) {
      items.set(follower.id, follower);
      return follower;
    },
    async findByUserAndCalendar(userId, calendarId) {
      return (
        [...items.values()].find((item) => item.userId === userId && item.calendarId === calendarId) ??
        null
      );
    },
    async listByCalendar(calendarId) {
      return [...items.values()].filter((item) => item.calendarId === calendarId);
    },
    async countByCalendar(calendarId) {
      return [...items.values()].filter((item) => item.calendarId === calendarId).length;
    },
    async save(follower) {
      items.set(follower.id, follower);
      return follower;
    },
    async delete(id) {
      items.delete(id);
    },
  };
}

export function createMemorySubscriptions(): CalendarSubscriptionRepository {
  const items = new Map<string, CalendarSubscription>();
  return {
    async create(subscription) {
      items.set(subscription.id, subscription);
      return subscription;
    },
    async findByEmailAndCalendar(email, calendarId) {
      return (
        [...items.values()].find((item) => item.email === email && item.calendarId === calendarId) ??
        null
      );
    },
    async listByCalendar(calendarId) {
      return [...items.values()].filter((item) => item.calendarId === calendarId);
    },
    async save(subscription) {
      items.set(subscription.id, subscription);
      return subscription;
    },
  };
}

export function createMemoryTiers(): CalendarMembershipTierRepository {
  const items = new Map<string, CalendarMembershipTier>();
  return {
    async create(tier) {
      items.set(tier.id, tier);
      return tier;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByCalendar(calendarId) {
      return [...items.values()].filter((item) => item.calendarId === calendarId);
    },
    async save(tier) {
      items.set(tier.id, tier);
      return tier;
    },
    async delete(id) {
      items.delete(id);
    },
  };
}

export function createMemoryCalendarMembers(): CalendarMemberRepository {
  const items = new Map<string, CalendarMember>();
  return {
    async create(member) {
      items.set(member.id, member);
      return member;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByUserAndCalendar(userId, calendarId) {
      return (
        [...items.values()].find((item) => item.userId === userId && item.calendarId === calendarId) ??
        null
      );
    },
    async listByCalendar(calendarId) {
      return [...items.values()].filter((item) => item.calendarId === calendarId);
    },
    async save(member) {
      items.set(member.id, member);
      return member;
    },
  };
}

export function createMemoryEvents(): EventRepository {
  const items = new Map<string, Event>();

  return {
    async create(event) {
      items.set(event.id, event);
      return event;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findBySlug(slug) {
      return [...items.values()].find((item) => item.slug === slug && !item.deletedAt) ?? null;
    },
    async findByCalendarAndSlug(calendarId, slug) {
      return (
        [...items.values()].find(
          (item) => item.calendarId === calendarId && item.slug === slug,
        ) ?? null
      );
    },
    async listByCalendar(calendarId, query?: EventListQuery) {
      return [...items.values()].filter((item) => {
        if (item.calendarId !== calendarId) return false;
        if (query?.status && item.status !== query.status) return false;
        if (query?.from && item.startsAt < query.from) return false;
        if (query?.to && item.startsAt > query.to) return false;
        return true;
      });
    },
    async listPublic(excludeId?: string) {
      return [...items.values()].filter(
        (item) => item.visibility === "public" && !item.deletedAt && item.id !== excludeId,
      );
    },
    async update(event) {
      items.set(event.id, event);
      return event;
    },
  };
}

const ACTIVE = new Set(["pending", "confirmed", "offered", "checked_in"]);

export function createMemoryRegistrations(): EventRegistrationRepository {
  const items = new Map<string, EventRegistration>();
  return {
    async create(registration) {
      items.set(registration.id, registration);
      return registration;
    },
    async createIfCapacity(registration, capacity, quantity) {
      const taken = [...items.values()]
        .filter((item) => item.eventId === registration.eventId && ACTIVE.has(item.status))
        .reduce((sum, item) => sum + item.quantity, 0);
      if (capacity != null && taken + quantity > capacity) {
        return { ok: false, taken };
      }
      items.set(registration.id, registration);
      return { ok: true, registration };
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByEventAndUser(eventId, userId) {
      return (
        [...items.values()].find((item) => item.eventId === eventId && item.userId === userId) ??
        null
      );
    },
    async findByEventAndEmail(eventId, email) {
      return (
        [...items.values()].find((item) => item.eventId === eventId && item.email === email) ?? null
      );
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async listAll() {
      return [...items.values()];
    },
    async countActive(eventId) {
      return [...items.values()]
        .filter((item) => item.eventId === eventId && ACTIVE.has(item.status))
        .reduce((sum, item) => sum + item.quantity, 0);
    },
    async save(registration) {
      items.set(registration.id, registration);
      return registration;
    },
  };
}

export function createMemoryTickets(): TicketTypeRepository {
  const items = new Map<string, TicketType>();
  return {
    async create(ticket) {
      items.set(ticket.id, ticket);
      return ticket;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async listAll() {
      return [...items.values()];
    },
    async save(ticket) {
      items.set(ticket.id, ticket);
      return ticket;
    },
  };
}

export function createMemoryCoupons(): CouponRepository {
  const items = new Map<string, Coupon>();
  return {
    async create(coupon) {
      items.set(coupon.id, coupon);
      return coupon;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByCode(code) {
      return [...items.values()].find((item) => item.code === code) ?? null;
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async save(coupon) {
      items.set(coupon.id, coupon);
      return coupon;
    },
  };
}

export function createMemoryAddOns(): AddOnRepository {
  const items = new Map<string, AddOn>();
  return {
    async create(addOn) {
      items.set(addOn.id, addOn);
      return addOn;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async save(addOn) {
      items.set(addOn.id, addOn);
      return addOn;
    },
  };
}

export function createMemoryOrders(): OrderRepository {
  const orders = new Map<string, EventOrder>();
  const items = new Map<string, EventOrderItem[]>();
  return {
    async create(order, orderItems) {
      orders.set(order.id, order);
      items.set(order.id, orderItems);
      return order;
    },
    async findById(id) {
      return orders.get(id) ?? null;
    },
    async listByEvent(eventId) {
      return [...orders.values()].filter((order) => order.eventId === eventId);
    },
    async listItems(orderId) {
      return items.get(orderId) ?? [];
    },
    async save(order) {
      orders.set(order.id, order);
      return order;
    },
  };
}

export function createMemoryContent(): EventContentRepository {
  const items = new Map<string, EventContent>();
  return {
    async create(item) {
      items.set(item.id, item);
      return item;
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async delete(id) {
      items.delete(id);
    },
  };
}

export function createMemoryRecurrences(): RecurrenceRuleRepository {
  const items = new Map<string, RecurrenceRule>();
  return {
    async save(rule) {
      items.set(rule.eventId, rule);
      return rule;
    },
    async findByEvent(eventId) {
      return items.get(eventId) ?? null;
    },
  };
}

export function createMemoryOverrides(): OccurrenceOverrideRepository {
  const items: OccurrenceOverride[] = [];
  return {
    async save(override) {
      const index = items.findIndex((item) => item.id === override.id);
      if (index >= 0) items[index] = override;
      else items.push(override);
      return override;
    },
    async findByEventAndOriginal(eventId, originalStartsAt) {
      return (
        items.find(
          (item) =>
            item.eventId === eventId &&
            item.originalStartsAt.getTime() === originalStartsAt.getTime(),
        ) ?? null
      );
    },
    async listByEvent(eventId) {
      return items.filter((item) => item.eventId === eventId);
    },
  };
}

export function createMemoryChats(): EventChatRepository {
  const items = new Map<string, EventChat>();
  return {
    async create(chat) {
      items.set(chat.id, chat);
      return chat;
    },
    async findByEvent(eventId) {
      return [...items.values()].find((item) => item.eventId === eventId) ?? null;
    },
    async save(chat) {
      items.set(chat.id, chat);
      return chat;
    },
  };
}

export function createMemoryChatThreads(): EventChatThreadRepository {
  const items = new Map<string, EventChatThread>();
  return {
    async create(thread) {
      items.set(thread.id, thread);
      return thread;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
  };
}

export function createMemoryChatMessages(): EventChatMessageRepository {
  const items = new Map<string, EventChatMessage>();
  return {
    async create(message) {
      items.set(message.id, message);
      return message;
    },
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findByClientId(chatId, clientId) {
      return (
        [...items.values()].find((item) => item.chatId === chatId && item.clientId === clientId) ??
        null
      );
    },
    async listByEvent(eventId, query) {
      let rows = [...items.values()].filter((item) => item.eventId === eventId);
      if (query.threadId) rows = rows.filter((item) => item.threadId === query.threadId);
      if (query.afterSeq != null) rows = rows.filter((item) => item.seq > query.afterSeq!);
      if (query.beforeSeq != null) rows = rows.filter((item) => item.seq < query.beforeSeq!);
      rows.sort((a, b) =>
        query.afterSeq != null ? a.seq - b.seq : b.seq - a.seq,
      );
      return rows.slice(0, query.limit);
    },
    async save(message) {
      items.set(message.id, message);
      return message;
    },
  };
}

export function createMemoryChatReports(): EventChatReportRepository {
  const items = new Map<string, EventChatReport>();
  return {
    async create(report) {
      items.set(report.id, report);
      return report;
    },
    async findByMessageAndReporter(messageId, reporterUserId) {
      return (
        [...items.values()].find(
          (item) => item.messageId === messageId && item.reporterUserId === reporterUserId,
        ) ?? null
      );
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async save(report) {
      items.set(report.id, report);
      return report;
    },
  };
}

export function createMemoryChatModeration(): EventChatModerationRepository {
  const items: EventChatModerationAction[] = [];
  return {
    async create(action) {
      items.push(action);
      return action;
    },
    async listByEvent(eventId) {
      return items.filter((item) => item.eventId === eventId);
    },
    async listByUser(eventId, userId) {
      return items.filter((item) => item.eventId === eventId && item.targetUserId === userId);
    },
  };
}
