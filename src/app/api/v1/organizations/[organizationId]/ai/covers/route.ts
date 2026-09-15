import { resolveActor } from "@/api/authorize";
import { coverBodySchema } from "@/api/ai-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { requestAuditContext, writeAuditLog } from "@/db/audit";
import { NotFoundError } from "@/domain/errors";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const POST = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId, request: req }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(services.access, user!.id, organizationId, user!.emailVerified);
    const body = coverBodySchema.parse(await readJson(req));
    let palette = body.palette;
    if (!palette && body.calendarId) {
      const calendar = await services.calendarRepo.findById(body.calendarId);
      if (!calendar || calendar.deletedAt) throw new NotFoundError("Calendar", body.calendarId);
      palette = services.ai.paletteFor(calendar);
    }
    const data = await services.ai.generateCover(actor, {
      title: body.title,
      tags: body.tags ?? [],
      style: body.style ?? "modern_minimal",
      palette: palette ?? { primary: "#18181b", secondary: "#f4f4f5" },
      providerId: body.providerId,
    });
    await writeAuditLog(services.db, {
      organizationId: actor.organizationId,
      actorUserId: user!.id,
      action: "ai.cover.generate",
      resourceType: "ai_generation",
      metadata: { style: data.style, status: data.status, providerId: data.providerId },
      requestId,
      ...requestAuditContext(req),
    });
    return jsonOk(data, { requestId, status: 201 });
  })(request);
