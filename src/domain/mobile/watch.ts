import { ValidationError } from "@/domain/errors";
import {
  WATCH_ARCHITECTURE_STATUS,
  WATCH_BIDIRECTIONAL_SYNC,
  WATCH_SERVER_CHANNEL,
  type WatchCompanionPayload,
  type WatchTransport,
  type WidgetNextEvent,
} from "@/domain/mobile/types";

export const WATCH_SYNC_POLICY = {
  appleWatch: true,
  wearOs: true,
  bidirectionalSync: WATCH_BIDIRECTIONAL_SYNC,
  serverChannel: WATCH_SERVER_CHANNEL,
  conflictResolution: "none" as const,
  status: WATCH_ARCHITECTURE_STATUS,
};

export function watchTransportFor(platform: "ios" | "android"): WatchTransport {
  return platform === "ios" ? "watchconnectivity" : "wear_data_layer";
}

export function prepareWatchCompanion(input: {
  platform: "ios" | "android";
  now: Date;
  nextEvent: WidgetNextEvent | null;
  qr: { registrationId: string; token: string } | null;
}): WatchCompanionPayload {
  return {
    transport: watchTransportFor(input.platform),
    bidirectionalSync: false,
    serverChannel: false,
    status: WATCH_ARCHITECTURE_STATUS,
    generatedAt: input.now.toISOString(),
    nextEvent: input.nextEvent,
    qr: input.qr,
  };
}

export function assertWatchServerSyncNotShipped(): never {
  throw new ValidationError(
    "Watch bidirectional sync is not shipped; companions only display a phone-copied snapshot",
  );
}
