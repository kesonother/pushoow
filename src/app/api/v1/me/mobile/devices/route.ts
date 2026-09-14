import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { MOBILE_PLATFORMS, MOBILE_PUSH_PROVIDERS } from "@/domain/mobile/types";
import { getServices } from "@/server/container";

const registerSchema = z.object({
  platform: z.enum(MOBILE_PLATFORMS),
  token: z.string().min(16).max(4096),
  pushProvider: z.enum(MOBILE_PUSH_PROVIDERS).optional(),
  appBundleId: z.string().min(1).max(180).optional(),
  widgetInstalled: z.boolean().optional(),
  watchPaired: z.boolean().optional(),
});

export const GET = withApi(async ({ user, requestId }) => {
  return jsonOk(await getServices().mobile.listDevices(user!.id), { requestId });
});

export const POST = withApi(async ({ user, requestId, request }) => {
  const body = registerSchema.parse(await readJson(request));
  const device = await getServices().mobile.registerDevice(user!.id, body);
  return jsonOk(device, { requestId, status: 201 });
});
