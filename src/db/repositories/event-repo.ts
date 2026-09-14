import { and, eq, gte, isNull, lte, ne } from "drizzle-orm";
import type { Database } from "@/db/client";
import { event } from "@/db/schema";
import type {
  Event,
  EventDateChange,
  EventListQuery,
  EventRepository,
  EventStatus,
  EventVisibility,
  LocationKind,
  RegistrationMode,
  RosterMode,
} from "@/domain/event/types";

function searchDocument(item: Pick<Event, "title" | "description" | "tags" | "city" | "country" | "venueName" | "venueAddress">) {
  return [item.title, item.description, item.tags.join(" "), item.city, item.country, item.venueName, item.venueAddress]
    .filter(Boolean)
    .join(" ");
}

function mapEvent(row: typeof event.$inferSelect): Event {
  return {
    id: row.id,
    organizationId: row.organizationId,
    calendarId: row.calendarId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    status: row.status as EventStatus,
    visibility: row.visibility as EventVisibility,
    isPaid: row.isPaid,
    isFeatured: row.isFeatured,
    tags: row.tags ?? [],
    city: row.city,
    country: row.country,
    category: row.category,
    language: row.language,
    venueName: row.venueName,
    venueAddress: row.venueAddress,
    coverImageUrl: row.coverImageUrl,
    capacity: row.capacity,
    organizerUserId: row.organizerUserId,
    locationKind: row.locationKind as LocationKind,
    latitude: row.latitude,
    longitude: row.longitude,
    customPinLabel: row.customPinLabel,
    virtualUrl: row.virtualUrl,
    virtualProvider: row.virtualProvider,
    templateId: row.templateId,
    registrationMode: row.registrationMode as RegistrationMode,
    rosterMode: (row.rosterMode as RosterMode | undefined) ?? "hidden",
    registrationPasswordHash: row.registrationPasswordHash,
    allowedEmailDomains: row.allowedEmailDomains ?? [],
    accessToken: row.accessToken,
    waitlistEnabled: row.waitlistEnabled,
    waitlistDuringPresale: row.waitlistDuringPresale,
    seriesId: row.seriesId,
    recurrenceParentId: row.recurrenceParentId,
    isOccurrenceOverride: row.isOccurrenceOverride,
    postponedFromStartsAt: row.postponedFromStartsAt,
    postponedFromEndsAt: row.postponedFromEndsAt,
    dateHistory: (row.dateHistory ?? []) as EventDateChange[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function createDrizzleEventRepository(db: Database): EventRepository {
  return {
    async create(item) {
      const [row] = await db.insert(event).values({ ...item, searchText: searchDocument(item) }).returning();
      return mapEvent(row);
    },
    async findById(id) {
      const [row] = await db.select().from(event).where(eq(event.id, id)).limit(1);
      return row ? mapEvent(row) : null;
    },
    async findBySlug(slug) {
      const [row] = await db
        .select()
        .from(event)
        .where(and(eq(event.slug, slug), isNull(event.deletedAt)))
        .limit(1);
      return row ? mapEvent(row) : null;
    },
    async findByCalendarAndSlug(calendarId, slug) {
      const [row] = await db
        .select()
        .from(event)
        .where(
          and(eq(event.calendarId, calendarId), eq(event.slug, slug), isNull(event.deletedAt)),
        )
        .limit(1);
      return row ? mapEvent(row) : null;
    },
    async listByCalendar(calendarId, query?: EventListQuery) {
      const filters = [eq(event.calendarId, calendarId), isNull(event.deletedAt)];
      if (query?.status) filters.push(eq(event.status, query.status));
      if (query?.from) filters.push(gte(event.startsAt, query.from));
      if (query?.to) filters.push(lte(event.startsAt, query.to));
      const rows = await db.select().from(event).where(and(...filters));
      return rows.map(mapEvent);
    },
    async listByOrganization(organizationId, query?: EventListQuery) {
      const filters = [eq(event.organizationId, organizationId), isNull(event.deletedAt)];
      if (query?.status) filters.push(eq(event.status, query.status));
      if (query?.from) filters.push(gte(event.startsAt, query.from));
      if (query?.to) filters.push(lte(event.startsAt, query.to));
      const rows = await db.select().from(event).where(and(...filters));
      return rows.map(mapEvent);
    },
    async listPublic(excludeId?: string) {
      const filters = [eq(event.visibility, "public"), isNull(event.deletedAt)];
      if (excludeId) filters.push(ne(event.id, excludeId));
      const rows = await db.select().from(event).where(and(...filters));
      return rows.map(mapEvent);
    },
    async update(item) {
      const [row] = await db
        .update(event)
        .set({
          title: item.title,
          slug: item.slug,
          description: item.description,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          timezone: item.timezone,
          status: item.status,
          visibility: item.visibility,
          isPaid: item.isPaid,
          isFeatured: item.isFeatured,
          tags: item.tags,
          city: item.city,
          country: item.country,
          category: item.category,
          language: item.language,
          searchText: searchDocument(item),
          venueName: item.venueName,
          venueAddress: item.venueAddress,
          coverImageUrl: item.coverImageUrl,
          capacity: item.capacity,
          organizerUserId: item.organizerUserId,
          locationKind: item.locationKind,
          latitude: item.latitude,
          longitude: item.longitude,
          customPinLabel: item.customPinLabel,
          virtualUrl: item.virtualUrl,
          virtualProvider: item.virtualProvider,
          templateId: item.templateId,
          registrationMode: item.registrationMode,
          rosterMode: item.rosterMode,
          registrationPasswordHash: item.registrationPasswordHash,
          allowedEmailDomains: item.allowedEmailDomains,
          accessToken: item.accessToken,
          waitlistEnabled: item.waitlistEnabled,
          waitlistDuringPresale: item.waitlistDuringPresale,
          seriesId: item.seriesId,
          recurrenceParentId: item.recurrenceParentId,
          isOccurrenceOverride: item.isOccurrenceOverride,
          postponedFromStartsAt: item.postponedFromStartsAt,
          postponedFromEndsAt: item.postponedFromEndsAt,
          dateHistory: item.dateHistory,
          updatedAt: item.updatedAt,
          deletedAt: item.deletedAt,
        })
        .where(eq(event.id, item.id))
        .returning();
      return mapEvent(row);
    },
  };
}
