import { ConflictError, ValidationError } from "@/domain/errors";
import type { Actor } from "@/domain/rbac/permissions";
import { assertPermission } from "@/domain/rbac/permissions";
import { assertSameTenant } from "@/domain/tenant/isolation";
import {
  defaultCalendarBranding,
  type Calendar,
  type CalendarRepository,
  type CalendarSlugChangeRepository,
  type CalendarVisibility,
} from "@/domain/calendar/types";
import {
  assertCalendarSlug,
  MAX_SLUG_CHANGES_PER_YEAR,
  noopBrandChecker,
  type BrandCheckAdapter,
} from "@/domain/calendar/slug-policy";
import { normalizeBannedWords } from "@/domain/chat/banned-words";
import type { Clock } from "@/lib/clock";
import { systemClock } from "@/lib/clock";
import type { IdGenerator } from "@/lib/ids";
import { cuidGenerator } from "@/lib/ids";

export type CalendarWriteInput = {
  templateId?: string | null;
  name?: string;
  slug?: string;
  description?: string | null;
  timezone?: string;
  locale?: string;
  defaultCurrency?: string;
  visibility?: CalendarVisibility;
  tags?: string[];
  logoUrl?: string | null;
  primaryColor?: string | null;
  bannerUrl?: string | null;
  socialLink?: string | null;
  contactEmail?: string | null;
  postalAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bannedWords?: string[];
};

export type CalendarQuota = {
  used: number;
  limit: number;
  remaining: number;
};

export type CalendarServiceDeps = {
  calendars: CalendarRepository;
  slugChanges?: CalendarSlugChangeRepository;
  brandChecker?: BrandCheckAdapter;
  limits?: {
    forOrganization: (organizationId: string) => Promise<CalendarQuota>;
  };
  organizationBranding?: (organizationId: string) => Promise<{
    logoUrl: string | null;
    primaryColor: string | null;
  } | null>;
  clock?: Clock;
  ids?: IdGenerator;
  onCreated?: (input: { actor: Actor; calendar: Calendar }) => Promise<void>;
};

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

function normalizeColor(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  const color = value.trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
    throw new ValidationError("primaryColor must be a hex color like #112233");
  }
  return color.toLowerCase();
}

export function createCalendarService(deps: CalendarServiceDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cuidGenerator;
  const brand = deps.brandChecker ?? noopBrandChecker;

  async function createCalendar(actor: Actor, input: CalendarWriteInput & { name: string }) {
    assertPermission(actor, "calendars:create");
    const name = input.name.trim();
    if (name.length < 2) {
      throw new ValidationError("Calendar name is too short");
    }

    if (deps.limits) {
      const quota = await deps.limits.forOrganization(actor.organizationId);
      if (quota.remaining <= 0) {
        throw new ValidationError("Calendar limit reached for this organization", {
          used: quota.used,
          limit: quota.limit,
        });
      }
    }

    const slug = await assertCalendarSlug(input.slug ?? name, brand);
    const taken = await deps.calendars.findBySlug(slug);
    if (taken) {
      throw new ConflictError("A calendar with this slug already exists", { slug });
    }

    const now = clock.now();
    const branding = defaultCalendarBranding();
    const inherited = deps.organizationBranding
      ? await deps.organizationBranding(actor.organizationId)
      : null;
    const created = await deps.calendars.create({
      id: ids.id(),
      organizationId: actor.organizationId,
      slug,
      name,
      description: input.description?.trim() || null,
      timezone: input.timezone ?? "UTC",
      locale: input.locale ?? "en",
      defaultCurrency: (input.defaultCurrency ?? "EUR").toUpperCase(),
      visibility: input.visibility ?? "public",
      tags: normalizeTags(input.tags),
      bannedWords: normalizeBannedWords(input.bannedWords),
      feedToken: ids.id(),
      ...branding,
      logoUrl: input.logoUrl !== undefined ? input.logoUrl : (inherited?.logoUrl ?? null),
      primaryColor:
        input.primaryColor !== undefined
          ? normalizeColor(input.primaryColor)
          : inherited?.primaryColor ?? null,
      bannerUrl: input.bannerUrl ?? null,
      socialLink: input.socialLink ?? null,
      contactEmail: input.contactEmail?.trim().toLowerCase() || null,
      postalAddress: input.postalAddress?.trim() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await deps.onCreated?.({ actor, calendar: created });
    return created;
  }

  async function listCalendars(actor: Actor): Promise<Calendar[]> {
    assertPermission(actor, "organization:read");
    const calendars = await deps.calendars.listByOrganization(actor.organizationId);
    return calendars.filter((calendar) => !calendar.deletedAt);
  }

  async function getCalendar(actor: Actor, calendarId: string): Promise<Calendar> {
    assertPermission(actor, "organization:read");
    const calendar = await deps.calendars.findById(calendarId);
    assertSameTenant(calendar, actor.organizationId, "Calendar");
    return calendar as Calendar;
  }

  async function updateCalendar(
    actor: Actor,
    calendarId: string,
    input: CalendarWriteInput,
  ): Promise<Calendar> {
    assertPermission(actor, "calendars:update");
    const calendar = await getCalendar(actor, calendarId);
    let nextSlug = calendar.slug;

    if (input.slug && input.slug !== calendar.slug) {
      nextSlug = await assertCalendarSlug(input.slug, brand);
      const existing = await deps.calendars.findBySlug(nextSlug);
      if (existing && existing.id !== calendar.id) {
        throw new ConflictError("A calendar with this slug already exists", { slug: nextSlug });
      }
      if (deps.slugChanges) {
        const since = new Date(clock.now().getTime() - 365 * 24 * 60 * 60 * 1000);
        const used = await deps.slugChanges.countSince(calendar.id, since);
        if (used >= MAX_SLUG_CHANGES_PER_YEAR) {
          throw new ValidationError("A calendar slug can only be changed twice per year");
        }
        await deps.slugChanges.create({
          id: ids.id(),
          calendarId: calendar.id,
          fromSlug: calendar.slug,
          toSlug: nextSlug,
          changedAt: clock.now(),
        });
      }
    }

    return deps.calendars.update({
      ...calendar,
      name: input.name?.trim() ?? calendar.name,
      slug: nextSlug,
      description:
        input.description === undefined ? calendar.description : input.description?.trim() || null,
      timezone: input.timezone ?? calendar.timezone,
      locale: input.locale ?? calendar.locale,
      defaultCurrency: input.defaultCurrency
        ? input.defaultCurrency.toUpperCase()
        : calendar.defaultCurrency,
      visibility: input.visibility ?? calendar.visibility,
      tags: input.tags ? normalizeTags(input.tags) : calendar.tags,
      bannedWords:
        input.bannedWords === undefined
          ? calendar.bannedWords
          : normalizeBannedWords(input.bannedWords),
      logoUrl: input.logoUrl === undefined ? calendar.logoUrl : input.logoUrl,
      primaryColor:
        input.primaryColor === undefined
          ? calendar.primaryColor
          : normalizeColor(input.primaryColor),
      bannerUrl: input.bannerUrl === undefined ? calendar.bannerUrl : input.bannerUrl,
      socialLink: input.socialLink === undefined ? calendar.socialLink : input.socialLink,
      contactEmail:
        input.contactEmail === undefined
          ? calendar.contactEmail
          : input.contactEmail?.trim().toLowerCase() || null,
      postalAddress:
        input.postalAddress === undefined
          ? calendar.postalAddress
          : input.postalAddress?.trim() || null,
      latitude: input.latitude === undefined ? calendar.latitude : input.latitude,
      longitude: input.longitude === undefined ? calendar.longitude : input.longitude,
      updatedAt: clock.now(),
    });
  }

  async function deleteCalendar(actor: Actor, calendarId: string): Promise<Calendar> {
    assertPermission(actor, "calendars:delete");
    const calendar = await getCalendar(actor, calendarId);
    return deps.calendars.update({
      ...calendar,
      deletedAt: clock.now(),
      updatedAt: clock.now(),
    });
  }

  return {
    createCalendar,
    listCalendars,
    getCalendar,
    updateCalendar,
    deleteCalendar,
  };
}
