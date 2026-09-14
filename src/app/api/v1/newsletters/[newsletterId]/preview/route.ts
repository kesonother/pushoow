import { z } from "zod";
import { resolveCalendarActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

const schema = z.object({ viewport: z.enum(["desktop", "mobile"]).default("desktop") });

type RouteContext = { params: Promise<{ newsletterId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { newsletterId } = await context.params;
    const services = getServices();
    const newsletter = await services.notifications.getNewsletter(newsletterId);
    if (!newsletter) throw new NotFoundError("Newsletter", newsletterId);
    await resolveCalendarActor(
      { memberships: services.access, calendars: services.calendarRepo },
      user!.id,
      newsletter.calendarId,
    );
    const body = schema.parse(await readJson(request));
    return jsonOk(services.notifications.previewNewsletter(newsletter, body.viewport, new Map()), { requestId });
  })(request);
