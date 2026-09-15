export const ROUTE_CLASSES = ["public_page", "dashboard", "checkout", "health", "other"] as const;
export type RouteClass = (typeof ROUTE_CLASSES)[number];

export function classifyRoute(pathname: string): RouteClass {
  if (pathname.startsWith("/api/v1/health") || pathname === "/api/v1/metrics") return "health";
  if (
    pathname.includes("/checkout") ||
    pathname.includes("/quote") ||
    pathname.includes("/payments") ||
    pathname.endsWith("/register") ||
    pathname.includes("/billing")
  ) {
    return "checkout";
  }
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/v1/organizations")) return "dashboard";
  if (
    pathname.startsWith("/discover") ||
    pathname.startsWith("/e/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/calendars") ||
    pathname.startsWith("/embed") ||
    pathname.startsWith("/press") ||
    pathname.startsWith("/r/") ||
    pathname === "/status" ||
    pathname.startsWith("/api/v1/discover") ||
    pathname.startsWith("/api/v1/status")
  ) {
    return "public_page";
  }
  return "other";
}

export function countsTowardAvailability(routeClass: RouteClass): boolean {
  return routeClass !== "health";
}
