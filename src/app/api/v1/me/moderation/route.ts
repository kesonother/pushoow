import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

const appealSchema = z.object({
  actionId: z.string().min(1),
  reason: z.string().min(3).max(2000),
});

export const GET = withApi(async ({ user, requestId }) => {
  const services = getServices();
  const history = await services.moderation.listHistory(user!.id);
  return jsonOk(history, { requestId });
});

export const POST = withApi(async ({ user, request, requestId }) => {
  const body = appealSchema.parse(await readJson(request));
  const services = getServices();
  const action = await services.moderation.appeal(user!.id, body.actionId, body.reason);
  return jsonOk(action, { requestId });
});
