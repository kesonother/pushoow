export const MOBILE_PLATFORMS = ["ios", "android"] as const;
export type MobilePlatform = (typeof MOBILE_PLATFORMS)[number];

export const MOBILE_FEATURES = [
  "discover",
  "map",
  "my_events",
  "my_calendars",
  "qr",
  "notifications",
  "offline_cache",
] as const;
export type MobileFeature = (typeof MOBILE_FEATURES)[number];

export const MOBILE_PUSH_PROVIDERS = ["apns", "fcm"] as const;
export type MobilePushProvider = (typeof MOBILE_PUSH_PROVIDERS)[number];

export const MOBILE_PUSH_CATEGORIES = ["new_event", "reminder", "update", "ticket", "check_in"] as const;
export type MobilePushCategory = (typeof MOBILE_PUSH_CATEGORIES)[number];

export const DEEP_LINK_KINDS = ["event", "calendar", "ticket"] as const;
export type DeepLinkKind = (typeof DEEP_LINK_KINDS)[number];

export const WATCH_TRANSPORTS = ["watchconnectivity", "wear_data_layer"] as const;
export type WatchTransport = (typeof WATCH_TRANSPORTS)[number];

/** Watch may display a phone-copied snapshot. It must not open its own server channel. */
export const WATCH_BIDIRECTIONAL_SYNC = false;
export const WATCH_SERVER_CHANNEL = false;
export const WATCH_ARCHITECTURE_STATUS = "prepared" as const;

export const WIDGET_KINDS = ["next_event", "countdown"] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export const SENSITIVE_CACHE_FIELDS = ["tickets.qrToken", "tickets.ticketCode"] as const;
export const CACHE_SEAL_ALG = "aes-256-gcm" as const;

export type MobileDevice = {
  id: string;
  userId: string;
  platform: MobilePlatform;
  pushProvider: MobilePushProvider;
  token: string;
  appBundleId: string | null;
  widgetInstalled: boolean;
  watchPaired: boolean;
  lastSnapshotAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
};

export type MobileDeviceRepository = {
  create: (item: MobileDevice) => Promise<MobileDevice>;
  save: (item: MobileDevice) => Promise<MobileDevice>;
  findById: (id: string) => Promise<MobileDevice | null>;
  findByToken: (token: string) => Promise<MobileDevice | null>;
  listByUser: (userId: string) => Promise<MobileDevice[]>;
};

export type CachedUpcomingEvent = {
  eventId: string;
  registrationId: string;
  slug: string;
  title: string;
  startsAt: string;
  status: string;
};

export type CachedTicket = {
  registrationId: string;
  eventId: string;
  title: string;
  startsAt: string;
  status: string;
  ticketCode: string | null;
  qrToken: string | null;
};

export type CachedCalendar = {
  calendarId: string;
  name: string;
  slug: string;
};

export type OfflineCachePayload = {
  upcomingEvents: CachedUpcomingEvent[];
  tickets: CachedTicket[];
  qrCodes: Array<{ registrationId: string; eventId: string; token: string }>;
  calendars: CachedCalendar[];
};

export type SealedCache = {
  alg: typeof CACHE_SEAL_ALG;
  iv: string;
  tag: string;
  ciphertext: string;
};

export type WidgetNextEvent = {
  eventId: string;
  registrationId: string;
  title: string;
  startsAt: string;
  slug: string;
};

export type WidgetSnapshot = {
  kind: "next_event" | "countdown";
  refresh: "pull";
  nextEvent: WidgetNextEvent | null;
  countdownSeconds: number | null;
};

export type WatchCompanionPayload = {
  transport: WatchTransport;
  bidirectionalSync: false;
  serverChannel: false;
  status: typeof WATCH_ARCHITECTURE_STATUS;
  generatedAt: string;
  nextEvent: WidgetNextEvent | null;
  qr: { registrationId: string; token: string } | null;
};

export type ParsedDeepLink = {
  kind: DeepLinkKind | "unknown";
  slugOrId: string | null;
  url: string;
};

export type ResolvedDeepLink = {
  kind: DeepLinkKind;
  url: string;
  webPath: string;
  appPath: string;
  eventId?: string;
  calendarId?: string;
  registrationId?: string;
  slug?: string;
  title?: string;
};

export type MobilePushPort = {
  provider: MobilePushProvider;
  isConfigured: () => boolean;
  send: (input: {
    token: string;
    category: MobilePushCategory;
    title: string;
    body: string;
    deepLink?: string;
  }) => Promise<{ providerMessageId: string | null }>;
};

export type MobileBootstrap = {
  platforms: typeof MOBILE_PLATFORMS;
  features: typeof MOBILE_FEATURES;
  endpoints: {
    discover: string;
    map: string;
    snapshot: string;
    devices: string;
    widget: string;
    links: string;
    notifications: string;
  };
  offline: {
    encryptedFields: typeof SENSITIVE_CACHE_FIELDS;
    algorithm: typeof CACHE_SEAL_ALG;
    caches: ["upcoming_events", "tickets", "qr_codes"];
  };
  push: {
    providers: typeof MOBILE_PUSH_PROVIDERS;
    categories: typeof MOBILE_PUSH_CATEGORIES;
    configured: Record<MobilePushProvider, boolean>;
  };
  deepLinks: {
    scheme: string;
    webTemplates: { event: string; calendar: string; ticket: string };
    appTemplates: { event: string; calendar: string; ticket: string };
  };
  widget: {
    kinds: typeof WIDGET_KINDS;
    refresh: "pull";
    writeBack: false;
  };
  watch: {
    appleWatch: true;
    wearOs: true;
    bidirectionalSync: false;
    serverChannel: false;
    status: typeof WATCH_ARCHITECTURE_STATUS;
    transports: typeof WATCH_TRANSPORTS;
  };
};
