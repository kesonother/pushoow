import { z } from "zod";
import { resolveActor } from "@/api/authorize";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { assertPermission } from "@/domain/rbac/permissions";
import { ORGANIZATION_ROLES } from "@/domain/rbac/roles";
import { writeAuditLog } from "@/db/audit";
import { getServices } from "@/server/container";
import { sendAuthEmail } from "@/auth/mailer";
import { getEnv } from "@/lib/env";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORGANIZATION_ROLES),
});

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { organizationId } = await context.params;
    const services = getServices();
    const actor = await resolveActor(
      services.memberships,
      user!.id,
      organizationId,
      user!.emailVerified,
    );
    assertPermission(actor.role, "members:read");
    const invitations = await services.invitations.listByOrganization(organizationId);
    return jsonOk(
      invitations.map((invitation) => {
        const { tokenHash, ...safe } = invitation;
        void tokenHash;
        return safe;
      }),
      { requestId },
    );
  })(request);

export const POST = (request: Request, context: RouteContext) =>
  withApi(
    async ({ user, requestId }) => {
      const { organizationId } = await context.params;
      const body = inviteSchema.parse(await readJson(request));
      const services = getServices();
      const actor = await resolveActor(
        services.memberships,
        user!.id,
        organizationId,
        user!.emailVerified,
      );
      const { invitation, token } = await services.members.invite(actor, body);
      const appUrl = getEnv().APP_URL ?? "http://localhost:3000";
      await sendAuthEmail({
        to: invitation.email,
        subject: "You were invited to a Pushoow organization",
        body: `Accept your invitation: ${appUrl}/invitations/accept?token=${token}`,
      });
      await writeAuditLog(services.db, {
        organizationId: actor.organizationId,
        actorUserId: user!.id,
        action: "member.invite",
        resourceType: "organization_invitation",
        resourceId: invitation.id,
        requestId,
      });
      const { tokenHash, ...safe } = invitation;
      void tokenHash;
      return jsonOk({ ...safe, token }, { status: 201, requestId });
    },
    { rateLimit: { limit: 20, windowMs: 60_000 } },
  )(request);
