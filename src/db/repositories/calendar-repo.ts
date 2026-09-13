import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { calendar, calendarSlugChange } from "@/db/schema";
import type {
  Calendar,
  CalendarRepository,
  CalendarSlugChange,
  CalendarSlugChangeRepository,
  CalendarVisibility,
} from "@/domain/calendar/types";

function mapCalendar(row: typeof calendar.$inferSelect): Calendar {
  return {
    id: row.id,
    organizationId: row.organizationId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    timezone: row.timezone,
    locale: row.locale,
    defaultCurrency: row.defaultCurrency,
    visibility: row.visibility as CalendarVisibility,
    tags: row.tags ?? [],
    bannedWords: row.bannedWords ?? [],
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    bannerUrl: row.bannerUrl,
    socialLink: row.socialLink,
    contactEmail: row.contactEmail,
    postalAddress: row.postalAddress,
    latitude: row.latitude,
    longitude: row.longitude,
    feedToken: row.feedToken,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function createDrizzleCalendarRepository(db: Database): CalendarRepository {
  return {
    async create(item) {
      const [row] = await db.insert(calendar).values(item).returning();
      return mapCalendar(row);
    },
    async findById(id) {
      const [row] = await db.select().from(calendar).where(eq(calendar.id, id)).limit(1);
      return row ? mapCalendar(row) : null;
    },
    async findBySlug(slug) {
      const [row] = await db.select().from(calendar).where(eq(calendar.slug, slug)).limit(1);
      return row ? mapCalendar(row) : null;
    },
    async findByOrganizationAndSlug(organizationId, slug) {
      const [row] = await db
        .select()
        .from(calendar)
        .where(
          and(
            eq(calendar.organizationId, organizationId),
            eq(calendar.slug, slug),
            isNull(calendar.deletedAt),
          ),
        )
        .limit(1);
      return row ? mapCalendar(row) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await db
        .select()
        .from(calendar)
        .where(and(eq(calendar.organizationId, organizationId), isNull(calendar.deletedAt)));
      return rows.map(mapCalendar);
    },
    async listPublic(excludeId?: string) {
      const filters = [eq(calendar.visibility, "public"), isNull(calendar.deletedAt)];
      if (excludeId) filters.push(ne(calendar.id, excludeId));
      const rows = await db.select().from(calendar).where(and(...filters));
      return rows.map(mapCalendar);
    },
    async update(item) {
      const [row] = await db
        .update(calendar)
        .set({
          name: item.name,
          slug: item.slug,
          description: item.description,
          timezone: item.timezone,
          locale: item.locale,
          defaultCurrency: item.defaultCurrency,
          visibility: item.visibility,
          tags: item.tags,
          bannedWords: item.bannedWords,
          logoUrl: item.logoUrl,
          primaryColor: item.primaryColor,
          bannerUrl: item.bannerUrl,
          socialLink: item.socialLink,
          contactEmail: item.contactEmail,
          postalAddress: item.postalAddress,
          latitude: item.latitude,
          longitude: item.longitude,
          feedToken: item.feedToken,
          updatedAt: item.updatedAt,
          deletedAt: item.deletedAt,
        })
        .where(eq(calendar.id, item.id))
        .returning();
      return mapCalendar(row);
    },
  };
}

export function createDrizzleCalendarSlugChangeRepository(
  db: Database,
): CalendarSlugChangeRepository {
  return {
    async create(change: CalendarSlugChange) {
      const [row] = await db.insert(calendarSlugChange).values(change).returning();
      return row;
    },
    async countSince(calendarId, since) {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(calendarSlugChange)
        .where(
          and(
            eq(calendarSlugChange.calendarId, calendarId),
            sql`${calendarSlugChange.changedAt} >= ${since}`,
          ),
        );
      return Number(row?.count ?? 0);
    },
  };
}
