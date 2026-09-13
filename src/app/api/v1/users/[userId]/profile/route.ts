import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export const GET = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { userId } = await context.params;
    const services = getServices();
    const profiles = await services.profiles.getProfiles(user!.id, userId);
    return jsonOk(profiles, { requestId });
  })(request);
