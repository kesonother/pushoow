import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(async ({ user, requestId }) => {
  const services = getServices();
  const accessible = await services.access.listAccessible(user!.id, user!.emailVerified);
  const organizationId = accessible[0]?.organization.id;
  const [organizer, attendee] = await Promise.all([
    services.onboarding.organizerProgress({ userId: user!.id, organizationId }),
    services.onboarding.attendeeProgress(user!.id),
  ]);
  return jsonOk({ organizer, attendee, organizationId: organizationId ?? null }, { requestId });
});
