import { cookies } from "next/headers";
import { orderSchema, registerSchema } from "@/api/event-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { REFERRAL_COOKIE } from "@/domain/referral/types";
import { getEnv } from "@/lib/env";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId, url }) => {
      const { eventId } = await context.params;
      const raw = await readJson<Record<string, unknown>>(request);
      if (Array.isArray((raw as { items?: unknown }).items)) {
        const body = orderSchema.parse(raw);
        const origin = getEnv().APP_URL ?? url.origin;
        const services = getServices();
        const result = await services.registrations.purchase({
          ...body,
          eventId,
          userId: user?.id,
          successUrl: `${origin}/e/${eventId}?paid=1`,
          cancelUrl: `${origin}/e/${eventId}?paid=0`,
        });
        try {
          const jar = await cookies();
          const code = jar.get(REFERRAL_COOKIE)?.value;
          if (code) {
            await services.referrals.attributeAttendeeRsvp({
              code,
              userId: user?.id,
              email: body.email,
              eventId,
              visitorHash: jar.get("pushoow.vid")?.value ?? null,
            });
          }
        } catch {
          /* referral must not block checkout */
        }
        return jsonOk(result, { status: 201, requestId });
      }
      const body = registerSchema.parse(raw);
      const services = getServices();
      const registration = await services.registrations.register({
        ...body,
        eventId,
        userId: user?.id,
      });
      try {
        const jar = await cookies();
        const code = jar.get(REFERRAL_COOKIE)?.value;
        if (code) {
          await services.referrals.attributeAttendeeRsvp({
            code,
            userId: user?.id,
            email: body.email,
            eventId,
            visitorHash: jar.get("pushoow.vid")?.value ?? null,
          });
        }
      } catch {
        /* referral must not block RSVP */
      }
      return jsonOk(registration, { status: 201, requestId });
    },
    { auth: "optional", rateLimit: { limit: 20, windowMs: 60_000 } },
  )(request);
