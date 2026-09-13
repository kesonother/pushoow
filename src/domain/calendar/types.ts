export const CALENDAR_VISIBILITIES = ["public", "unlisted", "private"] as const;
export type CalendarVisibility = (typeof CALENDAR_VISIBILITIES)[number];

export type CalendarBranding = {
  logoUrl: string | null;
  primaryColor: string | null;
  bannerUrl: string | null;
  socialLink: string | null;
  contactEmail: string | null;
  postalAddress: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Calendar = CalendarBranding & {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  timezone: string;
  locale: string;
  defaultCurrency: string;
  visibility: CalendarVisibility;
  tags: string[];
  bannedWords: string[];
  feedToken: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export const defaultCalendarBranding = (): CalendarBranding => ({
  logoUrl: null,
  primaryColor: null,
  bannerUrl: null,
  socialLink: null,
  contactEmail: null,
  postalAddress: null,
  latitude: null,
  longitude: null,
});

export type CalendarSlugChange = {
  id: string;
  calendarId: string;
  fromSlug: string;
  toSlug: string;
  changedAt: Date;
};

export type CalendarRepository = {
  create: (calendar: Calendar) => Promise<Calendar>;
  findById: (id: string) => Promise<Calendar | null>;
  findBySlug: (slug: string) => Promise<Calendar | null>;
  findByOrganizationAndSlug: (
    organizationId: string,
    slug: string,
  ) => Promise<Calendar | null>;
  listByOrganization: (organizationId: string) => Promise<Calendar[]>;
  listPublic: (excludeId?: string) => Promise<Calendar[]>;
  update: (calendar: Calendar) => Promise<Calendar>;
};

export type CalendarSlugChangeRepository = {
  create: (change: CalendarSlugChange) => Promise<CalendarSlugChange>;
  countSince: (calendarId: string, since: Date) => Promise<number>;
};
