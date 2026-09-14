import { jsonOk, withApi } from "@/api/handler";
import { incrementVelocity } from "@/domain/privacy/velocity";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ request, requestId }) => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    incrementVelocity({ key: `captcha:${ip}`, limit: 20, windowMs: 60_000 });
    return jsonOk(await getServices().privacy.issueCaptcha(), { requestId });
  },
  { auth: "none", rateLimit: { limit: 20, windowMs: 60_000 } },
);
