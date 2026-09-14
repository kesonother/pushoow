import { cookies } from "next/headers";
import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";
import { randomToken } from "@/lib/token-crypto";

type RouteContext = { params: Promise<{ eventId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ requestId }) => {
      const { eventId } = await context.params;
      const jar = await cookies();
      const existing = jar.get("pushoow.vid")?.value;
      const visitorId = existing ?? randomToken(16);
      if (!existing) {
        jar.set("pushoow.vid", visitorId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
      }
      return jsonOk(await getServices().analytics.recordView(eventId, visitorId), { requestId });
    },
    { auth: "none", rateLimit: { limit: 40, windowMs: 60_000 } },
  )(request);
