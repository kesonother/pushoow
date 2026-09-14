export const ANALYTICS_PLANS = ["free", "pro", "plus"] as const;
export type AnalyticsPlan = (typeof ANALYTICS_PLANS)[number];

export const REGISTRATION_SOURCES = ["direct", "checkout", "walk_in", "import", "search"] as const;
export type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];

export const EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_KINDS = ["organizer", "event", "registrants", "attendee"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export type RegistrationAttribution = {
  registrationId: string;
  organizationId: string;
  eventId: string;
  source: RegistrationSource;
  tags: string[];
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

export type PageViewDaily = {
  id: string;
  organizationId: string;
  eventId: string;
  day: string;
  views: number;
  uniqueVisitors: number;
};

export type AnalyticsSnapshot = {
  id: string;
  organizationId: string;
  scope: "organization" | "event";
  scopeId: string;
  payload: unknown;
  computedAt: Date;
};

export type AnalyticsPlanRecord = {
  organizationId: string;
  plan: AnalyticsPlan;
  updatedAt: Date;
};

export type OrganizerDashboard = {
  organizationId: string;
  computedAt: string;
  stale: boolean;
  followers: number;
  upcomingEvents: Array<{ id: string; title: string; startsAt: string; rsvps: number }>;
  monthlyRsvps: Array<{ month: string; count: number }>;
  monthlyRevenue: Array<{ month: string; capturedCents: number; refundedCents: number }>;
  heatmap: Array<{ date: string; count: number }>;
  topEvents: Array<{
    id: string;
    title: string;
    rsvps: number;
    attendance: number;
    revenueCents: number;
  }>;
};

export type EventDashboard = {
  eventId: string;
  organizationId: string;
  title: string;
  computedAt: string;
  stale: boolean;
  registrants: Array<{
    registrationId: string;
    displayName: string;
    email: string;
    status: string;
    tags: string[];
    registeredAt: string;
    source: RegistrationSource;
  }>;
  pageViews: number;
  rsvps: number;
  attendance: { checkedIn: number; rate: number | null };
  funnel: { viewed: number; registered: number; confirmed: number; checkedIn: number };
  emails: { sent: number; opened: number; failed: number };
  sms: { sent: number; failed: number };
  refunds: Array<{ id: string; amountCents: number; reason: string; createdAt: string }>;
  adjustments: Array<{ orderId: string; discountCents: number; currency: string }>;
};

export type AdvancedAnalytics = {
  available: boolean;
  plan: AnalyticsPlan;
  eventComparison: Array<{
    eventId: string;
    title: string;
    rsvps: number;
    attendance: number;
    revenueCents: number;
    pageViews: number;
  }>;
  cohorts: Array<{ month: string; registered: number; attended: number }>;
  utm: Array<{ source: string; registrations: number }>;
  geo: Array<{ place: string; events: number; rsvps: number }>;
  deliverability: {
    email: { sent: number; opened: number; clicked: number; failed: number; openRate: number | null };
    sms: { sent: number; failed: number };
  };
  forecast: { nextMonthRevenueCents: number; method: "trailing_average" };
};

export type AttendeeTicket = {
  registrationId: string;
  eventId: string;
  title: string;
  startsAt: string;
  status: string;
  ticketCode: string | null;
  qrToken: string | null;
};

export type AttendeeHome = {
  events: Array<{
    registrationId: string;
    eventId: string;
    slug: string;
    title: string;
    startsAt: string;
    status: string;
  }>;
  calendars: Array<{ calendarId: string; name: string; slug: string }>;
  tickets: AttendeeTicket[];
};

export type AttributionRepository = {
  findByRegistration: (registrationId: string) => Promise<RegistrationAttribution | null>;
  listByEvent: (eventId: string) => Promise<RegistrationAttribution[]>;
  listByOrganization: (organizationId: string) => Promise<RegistrationAttribution[]>;
  save: (item: RegistrationAttribution) => Promise<RegistrationAttribution>;
};

export type PageViewRepository = {
  increment: (input: {
    organizationId: string;
    eventId: string;
    day: string;
    visitorHash: string;
  }) => Promise<PageViewDaily>;
  listByEvent: (eventId: string) => Promise<PageViewDaily[]>;
  listByOrganization: (organizationId: string) => Promise<PageViewDaily[]>;
};

export type SnapshotRepository = {
  find: (scope: "organization" | "event", scopeId: string) => Promise<AnalyticsSnapshot | null>;
  save: (item: AnalyticsSnapshot) => Promise<AnalyticsSnapshot>;
};

export type AnalyticsPlanRepository = {
  find: (organizationId: string) => Promise<AnalyticsPlanRecord | null>;
  save: (item: AnalyticsPlanRecord) => Promise<AnalyticsPlanRecord>;
};
