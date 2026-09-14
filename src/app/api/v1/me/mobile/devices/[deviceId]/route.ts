import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

type RouteContext = { params: Promise<{ deviceId: string }> };

export const DELETE = (request: Request, context: RouteContext) =>
  withApi(async ({ user, requestId }) => {
    const { deviceId } = await context.params;
    return jsonOk(await getServices().mobile.revokeDevice(user!.id, deviceId), { requestId });
  })(request);
