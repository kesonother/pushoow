import { getEnv } from "@/lib/env";

export const DEFAULT_PUBLIC_ORIGIN = "http://localhost:3000";

export function publicOrigin(fallback?: string): string {
  const env = getEnv();
  const raw = env.APP_URL ?? env.BETTER_AUTH_URL ?? fallback ?? DEFAULT_PUBLIC_ORIGIN;
  return raw.replace(/\/$/, "");
}

export function absoluteUrl(path: string, origin = publicOrigin()): string {
  if (/^https?:\/\//i.test(path)) return path;
  const prefix = origin.replace(/\/$/, "");
  if (!path || path === "/") return prefix;
  return `${prefix}${path.startsWith("/") ? path : `/${path}`}`;
}
