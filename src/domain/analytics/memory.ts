import { sha256 } from "@/lib/token-crypto";
import type {
  AnalyticsPlanRecord,
  AnalyticsPlanRepository,
  AnalyticsSnapshot,
  AttributionRepository,
  PageViewDaily,
  PageViewRepository,
  RegistrationAttribution,
  SnapshotRepository,
} from "@/domain/analytics/types";

export function memoryAttributions(): AttributionRepository {
  const items = new Map<string, RegistrationAttribution>();
  return {
    async findByRegistration(registrationId) {
      return items.get(registrationId) ?? null;
    },
    async listByEvent(eventId) {
      return [...items.values()].filter((item) => item.eventId === eventId);
    },
    async listByOrganization(organizationId) {
      return [...items.values()].filter((item) => item.organizationId === organizationId);
    },
    async save(item) {
      items.set(item.registrationId, item);
      return item;
    },
  };
}

export function memoryPageViews(): PageViewRepository {
  const days = new Map<string, PageViewDaily>();
  const visitors = new Set<string>();
  return {
    async increment(input) {
      const key = `${input.eventId}:${input.day}`;
      const visitorKey = `${key}:${input.visitorHash}`;
      const existing = days.get(key) ?? {
        id: key,
        organizationId: input.organizationId,
        eventId: input.eventId,
        day: input.day,
        views: 0,
        uniqueVisitors: 0,
      };
      existing.views += 1;
      if (!visitors.has(visitorKey)) {
        visitors.add(visitorKey);
        existing.uniqueVisitors += 1;
      }
      days.set(key, existing);
      return existing;
    },
    async listByEvent(eventId) {
      return [...days.values()].filter((item) => item.eventId === eventId);
    },
    async listByOrganization(organizationId) {
      return [...days.values()].filter((item) => item.organizationId === organizationId);
    },
  };
}

export function memorySnapshots(): SnapshotRepository {
  const items = new Map<string, AnalyticsSnapshot>();
  return {
    async find(scope, scopeId) {
      return items.get(`${scope}:${scopeId}`) ?? null;
    },
    async save(item) {
      items.set(`${item.scope}:${item.scopeId}`, item);
      return item;
    },
  };
}

export function memoryAnalyticsPlans(): AnalyticsPlanRepository {
  const items = new Map<string, AnalyticsPlanRecord>();
  return {
    async find(organizationId) {
      return items.get(organizationId) ?? null;
    },
    async save(item) {
      items.set(item.organizationId, item);
      return item;
    },
  };
}

export function hashVisitor(value: string) {
  return sha256(value).slice(0, 32);
}
