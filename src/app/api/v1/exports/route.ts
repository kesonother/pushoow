import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { withApi } from "@/api/handler";
import { EXPORT_FORMATS, EXPORT_KINDS } from "@/domain/analytics/types";
import { getServices } from "@/server/container";

const schema = z.object({
  kind: z.enum(EXPORT_KINDS),
  format: z.enum(EXPORT_FORMATS),
  organizationId: z.string().optional(),
  eventId: z.string().optional(),
});

export const POST = withApi(async ({ user, request }) => {
  const body = schema.parse(await request.json());
  const services = getServices();
  const actor =
    body.kind === "attendee"
      ? { userId: user!.id }
      : await resolveActor(services.access, user!.id, body.organizationId ?? "", user!.emailVerified);
  const file = await services.analytics.exportDashboard(actor, body);
  return new Response(new Uint8Array(file.body), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${file.filename}"`,
    },
  });
});
