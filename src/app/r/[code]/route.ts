import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REFERRAL_COOKIE } from "@/domain/referral/types";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { code } = await context.params;
  const url = new URL(request.url);
  let location = `/register?ref=${encodeURIComponent(code)}`;
  try {
    const services = getServices();
    const found = await services.referrals.recordClick(code);
    if (found?.kind === "attendee" && found.eventId) {
      const event = await services.eventRepo.findById(found.eventId);
      if (event && !event.deletedAt) {
        location = `/e/${event.slug}?ref=${encodeURIComponent(found.code)}`;
      }
    } else if (found) {
      location = `/register?ref=${encodeURIComponent(found.code)}`;
    }
  } catch {
    location = `/register?ref=${encodeURIComponent(code)}`;
  }

  const response = NextResponse.redirect(new URL(location, url.origin), 307);
  const jar = await cookies();
  if (!jar.get(REFERRAL_COOKIE)?.value) {
    response.cookies.set(REFERRAL_COOKIE, code.trim().toUpperCase(), {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
