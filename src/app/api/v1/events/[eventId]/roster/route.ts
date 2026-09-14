import { resolveActor } from "@/api/authorize";
import { jsonOk, withApi } from "@/api/handler";
import { writeAuditLog } from "@/db/audit";
import { hasPermission } from "@/domain/rbac/permissions";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ eventId: string }> };

export const GET = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId }) => {
      const { eventId } = await context.params;
      const services = getServices();
      const event = await services.eventRepo.findById(eventId);
      let canReadRegistrants = false;
      let organizationId: string | null = null;
      let approvedAttendee = false;
      if (user && event) {
        try {
          const actor = await resolveActor(services.access, user.id, event.organizationId, user.emailVerified);
          organizationId = actor.organizationId;
          canReadRegistrants = hasPermission(actor.role, "registrants:read");
        } catch {
          organizationId = null;
        }
        const mine = await services.eventRegistrations.findByEventAndUser(eventId, user.id);
        approvedAttendee = Boolean(
          mine && (mine.status === "confirmed" || mine.status === "checked_in" || mine.status === "pending"),
        );
      }
      const roster = await services.privacy.getRoster({
        eventId,
        viewer: {
          userId: user?.id,
          organizationId,
          canReadRegistrants,
          approvedAttendee,
        },
      });
      if (canReadRegistrants) {
        await writeAuditLog(services.db, {
          actorUserId: user?.id,
          organizationId,
          action: "privacy.roster.staff_view",
          resourceType: "event",
          resourceId: eventId,
          requestId,
        });
      }
      return jsonOk(roster, { requestId });
    },
    { auth: "optional", rateLimit: { limit: 40, windowMs: 60_000 } },
  )(request);
