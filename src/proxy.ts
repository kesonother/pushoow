import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, negotiateLocale } from "@/i18n/config";
import { REFERRAL_COOKIE, REFERRAL_CODE_PATTERN } from "@/domain/referral/types";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  if (!request.nextUrl.pathname.startsWith("/embed")) {
    response.headers.set("x-frame-options", "DENY");
  }
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()",
  );

  const locale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!isLocale(locale)) {
    const negotiated = negotiateLocale(request.headers.get("accept-language"), DEFAULT_LOCALE);
    response.cookies.set(LOCALE_COOKIE, negotiated, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  const ref = request.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
  if (ref && REFERRAL_CODE_PATTERN.test(ref) && !request.cookies.get(REFERRAL_COOKIE)) {
    response.cookies.set(REFERRAL_COOKIE, ref, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
