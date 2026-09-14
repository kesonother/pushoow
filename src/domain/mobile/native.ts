import {
  MOBILE_FEATURES,
  SENSITIVE_CACHE_FIELDS,
  type MobileFeature,
  type MobilePlatform,
} from "@/domain/mobile/types";

export type NativeScreen = {
  feature: MobileFeature;
  ios: string;
  android: string;
  source: string;
  onlineRequired: boolean;
};

export const NATIVE_SCREENS: Record<MobileFeature, NativeScreen> = {
  discover: {
    feature: "discover",
    ios: "DiscoverView",
    android: "DiscoverScreen",
    source: "GET /api/v1/discover",
    onlineRequired: true,
  },
  map: {
    feature: "map",
    ios: "MapView",
    android: "MapScreen",
    source: "GET /api/v1/discover/map",
    onlineRequired: true,
  },
  my_events: {
    feature: "my_events",
    ios: "MyEventsView",
    android: "MyEventsScreen",
    source: "GET /api/v1/me/mobile/snapshot",
    onlineRequired: false,
  },
  my_calendars: {
    feature: "my_calendars",
    ios: "MyCalendarsView",
    android: "MyCalendarsScreen",
    source: "GET /api/v1/me/mobile/snapshot",
    onlineRequired: false,
  },
  qr: {
    feature: "qr",
    ios: "TicketQrView",
    android: "TicketQrScreen",
    source: "GET /api/v1/me/mobile/snapshot",
    onlineRequired: false,
  },
  notifications: {
    feature: "notifications",
    ios: "NotificationInboxView",
    android: "NotificationInboxScreen",
    source: "GET /api/v1/me/notifications",
    onlineRequired: true,
  },
  offline_cache: {
    feature: "offline_cache",
    ios: "EncryptedCacheStore",
    android: "EncryptedCacheStore",
    source: "GET /api/v1/me/mobile/snapshot",
    onlineRequired: false,
  },
};

export const NATIVE_WIDGET_PROVIDERS = {
  ios: "NextEventWidget / CountdownTimelineProvider (WidgetKit, pull-only)",
  android: "NextEventAppWidget / CountdownGlance (App Widget, pull-only)",
  writeBack: false,
} as const;

export const NATIVE_WATCH_TARGETS = {
  ios: "WatchCompanionTarget (WatchKit, WatchConnectivity replace-only snapshot)",
  android: "WearCompanionApp (Wear OS, Data Layer replace-only snapshot)",
  bidirectionalSync: false,
  serverChannel: false,
} as const;

export const WIDGET_FORBIDDEN_FIELDS = ["qrToken", "ticketCode"] as const;

export function screensFor(platform: MobilePlatform): NativeScreen[] {
  void platform;
  return MOBILE_FEATURES.map((feature) => NATIVE_SCREENS[feature]);
}

export function mustEncryptAtRest(field: string): boolean {
  return (SENSITIVE_CACHE_FIELDS as readonly string[]).includes(field);
}
