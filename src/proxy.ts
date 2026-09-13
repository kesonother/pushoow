import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/config";

export function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()",
  );

  const locale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!isLocale(locale)) {
    const accepted = request.headers.get("accept-language")?.split(",")[0]?.split("-")[0];
    response.cookies.set(LOCALE_COOKIE, isLocale(accepted) ? accepted : DEFAULT_LOCALE, {
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
