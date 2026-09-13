import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(async ({ user, requestId }) => {
  const services = getServices();
  const [profiles, organizations, memberships] = await Promise.all([
    services.profiles.getProfiles(user!.id, user!.id),
    services.organizations.listOrganizationsForUser(user!.id),
    services.memberships.listByUser(user!.id),
  ]);

  return jsonOk(
    {
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        emailVerified: user!.emailVerified,
      },
      profiles,
      organizations: organizations.map((organization) => ({
        ...organization,
        role: memberships.find((item) => item.organizationId === organization.id)?.role,
      })),
    },
    { requestId },
  );
});
