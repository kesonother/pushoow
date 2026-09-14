import { toNextJsHandler } from "better-auth/next-js";
import { jsonError } from "@/api/errors";
import { auth } from "@/auth/server";
import { incrementVelocity } from "@/domain/privacy/velocity";
import { cuidGenerator } from "@/lib/ids";
import { getServices } from "@/server/container";

const handler = toNextJsHandler(auth);

const CAPTCHA_PATHS = ["/sign-up/email", "/sign-in/email", "/sign-in/magic-link"];

function needsCaptcha(url: string) {
  return CAPTCHA_PATHS.some((path) => url.endsWith(path) || url.includes(path));
}

export const GET = handler.GET;

export async function POST(request: Request) {
  if (needsCaptcha(request.url)) {
    const requestId = request.headers.get("x-request-id") ?? cuidGenerator.id();
    try {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      incrementVelocity({ key: `auth:${ip}`, limit: 8, windowMs: 60_000 });
      const id = request.headers.get("x-captcha-id") ?? "";
      const answer = request.headers.get("x-captcha-answer") ?? "";
      await getServices().privacy.verifyCaptcha({ id, answer, action: "auth" });
    } catch (error) {
      return jsonError(error, requestId);
    }
  }
  return handler.POST(request);
}
