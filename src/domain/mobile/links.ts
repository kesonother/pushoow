import type { DeepLinkKind, ParsedDeepLink } from "@/domain/mobile/types";

export const MOBILE_URL_SCHEME = "pushoow";

export const WEB_DEEP_LINK_TEMPLATES = {
  event: "/e/{slug}",
  calendar: "/c/{slug}",
  ticket: "/me/tickets/{registrationId}",
} as const;

export const APP_DEEP_LINK_TEMPLATES = {
  event: `${MOBILE_URL_SCHEME}://event/{slug}`,
  calendar: `${MOBILE_URL_SCHEME}://calendar/{slug}`,
  ticket: `${MOBILE_URL_SCHEME}://ticket/{registrationId}`,
} as const;

function pathOf(raw: string): string {
  try {
    if (raw.includes("://")) {
      const url = new URL(raw);
      if (url.protocol === `${MOBILE_URL_SCHEME}:`) {
        return `/${url.host}${url.pathname}`.replace(/\/+$/, "");
      }
      return url.pathname.replace(/\/+$/, "") || "/";
    }
  } catch {
    return raw;
  }
  return raw.split("?")[0] ?? raw;
}

export function parseDeepLink(raw: string): ParsedDeepLink {
  const trimmed = raw.trim();
  const path = pathOf(trimmed);
  const event = path.match(/(?:^|\/)(?:e|event)\/([^/]+)$/);
  if (event?.[1]) return { kind: "event", slugOrId: decodeURIComponent(event[1]), url: trimmed };
  const calendar = path.match(/(?:^|\/)(?:c|calendar)\/([^/]+)$/);
  if (calendar?.[1]) return { kind: "calendar", slugOrId: decodeURIComponent(calendar[1]), url: trimmed };
  const ticket = path.match(/(?:^|\/)(?:me\/tickets|ticket)\/([^/]+)$/);
  if (ticket?.[1]) return { kind: "ticket", slugOrId: decodeURIComponent(ticket[1]), url: trimmed };
  return { kind: "unknown", slugOrId: null, url: trimmed };
}

export function webPathFor(kind: DeepLinkKind, id: string): string {
  if (kind === "event") return `/e/${id}`;
  if (kind === "calendar") return `/c/${id}`;
  return `/me/tickets/${id}`;
}

export function appPathFor(kind: DeepLinkKind, id: string): string {
  if (kind === "event") return `${MOBILE_URL_SCHEME}://event/${id}`;
  if (kind === "calendar") return `${MOBILE_URL_SCHEME}://calendar/${id}`;
  return `${MOBILE_URL_SCHEME}://ticket/${id}`;
}
