export const EVENT_STATUSES = [
  "draft",
  "published",
  "scheduled",
  "live",
  "ended",
  "cancelled",
  "postponed",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_VISIBILITIES = ["public", "unlisted", "private"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export const LOCATION_KINDS = ["physical", "virtual", "hybrid"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const REGISTRATION_MODES = [
  "open_rsvp",
  "approval",
  "invitation",
  "password",
  "email_domain",
  "token",
] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export const ROSTER_MODES = ["visible", "hidden", "anonymized", "approval_only"] as const;
export type RosterMode = (typeof ROSTER_MODES)[number];

export type EventDateChange = {
  fromStartsAt: string;
  fromEndsAt: string;
  toStartsAt: string;
  toEndsAt: string;
  changedAt: string;
};

export type Event = {
  id: string;
  organizationId: string;
  calendarId: string;
  slug: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  status: EventStatus;
  visibility: EventVisibility;
  isPaid: boolean;
  isFeatured: boolean;
  tags: string[];
  city: string | null;
  country: string | null;
  category: string | null;
  language: string | null;
  venueName: string | null;
  venueAddress: string | null;
  coverImageUrl: string | null;
  capacity: number | null;
  organizerUserId: string | null;
  locationKind: LocationKind;
  latitude: number | null;
  longitude: number | null;
  customPinLabel: string | null;
  virtualUrl: string | null;
  virtualProvider: string | null;
  templateId: string | null;
  registrationMode: RegistrationMode;
  rosterMode: RosterMode;
  registrationPasswordHash: string | null;
  allowedEmailDomains: string[];
  accessToken: string | null;
  waitlistEnabled: boolean;
  waitlistDuringPresale: boolean;
  seriesId: string | null;
  recurrenceParentId: string | null;
  isOccurrenceOverride: boolean;
  postponedFromStartsAt: Date | null;
  postponedFromEndsAt: Date | null;
  dateHistory: EventDateChange[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type EventListQuery = {
  status?: EventStatus;
  from?: Date;
  to?: Date;
};

export type EventRepository = {
  create: (event: Event) => Promise<Event>;
  findById: (id: string) => Promise<Event | null>;
  findBySlug: (slug: string) => Promise<Event | null>;
  findByCalendarAndSlug: (
    calendarId: string,
    slug: string,
  ) => Promise<Event | null>;
  listByCalendar: (calendarId: string, query?: EventListQuery) => Promise<Event[]>;
  listByOrganization?: (organizationId: string, query?: EventListQuery) => Promise<Event[]>;
  listPublic: (excludeId?: string) => Promise<Event[]>;
  update: (event: Event) => Promise<Event>;
};

export function isPublishStatus(status: EventStatus): boolean {
  return status === "published" || status === "scheduled" || status === "live";
}

export function isListedEventStatus(status: EventStatus): boolean {
  return status !== "draft" && status !== "ended";
}

export function eventDefaults(): Pick<
  Event,
  | "city"
  | "country"
  | "category"
  | "language"
  | "coverImageUrl"
  | "capacity"
  | "organizerUserId"
  | "locationKind"
  | "latitude"
  | "longitude"
  | "customPinLabel"
  | "virtualUrl"
  | "virtualProvider"
  | "templateId"
  | "registrationMode"
  | "rosterMode"
  | "registrationPasswordHash"
  | "allowedEmailDomains"
  | "accessToken"
  | "waitlistEnabled"
  | "waitlistDuringPresale"
  | "seriesId"
  | "recurrenceParentId"
  | "isOccurrenceOverride"
  | "postponedFromStartsAt"
  | "postponedFromEndsAt"
  | "dateHistory"
> {
  return {
    city: null,
    country: null,
    category: null,
    language: null,
    coverImageUrl: null,
    capacity: null,
    organizerUserId: null,
    locationKind: "physical",
    latitude: null,
    longitude: null,
    customPinLabel: null,
    virtualUrl: null,
    virtualProvider: null,
    templateId: null,
    registrationMode: "open_rsvp",
    rosterMode: "hidden",
    registrationPasswordHash: null,
    allowedEmailDomains: [],
    accessToken: null,
    waitlistEnabled: true,
    waitlistDuringPresale: false,
    seriesId: null,
    recurrenceParentId: null,
    isOccurrenceOverride: false,
    postponedFromStartsAt: null,
    postponedFromEndsAt: null,
    dateHistory: [],
  };
}

export type EventWriteInput = {
  calendarId?: string;
  title?: string;
  slug?: string;
  description?: string | null;
  startsAt?: Date;
  endsAt?: Date;
  timezone?: string;
  status?: EventStatus;
  visibility?: EventVisibility;
  isPaid?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  city?: string | null;
  country?: string | null;
  category?: string | null;
  language?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  coverImageUrl?: string | null;
  capacity?: number | null;
  locationKind?: LocationKind;
  latitude?: number | null;
  longitude?: number | null;
  customPinLabel?: string | null;
  virtualUrl?: string | null;
  virtualProvider?: string | null;
  templateId?: string | null;
  registrationMode?: RegistrationMode;
  rosterMode?: RosterMode;
  registrationPassword?: string | null;
  allowedEmailDomains?: string[];
  accessToken?: string | null;
  waitlistEnabled?: boolean;
  waitlistDuringPresale?: boolean;
};
