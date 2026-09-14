import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { MOBILE_PLATFORMS } from "@/domain/mobile/types";
import { getServices } from "@/server/container";

const sealSchema = z.object({
  deviceUnlockKey: z.string().min(16).max(256),
  platform: z.enum(MOBILE_PLATFORMS).optional(),
  deviceId: z.string().min(1).optional(),
});

export const GET = withApi(async ({ user, requestId, url }) => {
  const platform = url.searchParams.get("platform") === "android" ? "android" : "ios";
  const deviceId = url.searchParams.get("deviceId") ?? undefined;
  const snapshot = await getServices().mobile.snapshot(user!.id, {
    email: user!.email,
    platform,
    deviceId,
  });
  return jsonOk(snapshot, { requestId });
});

export const POST = withApi(async ({ user, requestId, request }) => {
  const body = sealSchema.parse(await readJson(request));
  const snapshot = await getServices().mobile.snapshot(user!.id, {
    email: user!.email,
    deviceUnlockKey: body.deviceUnlockKey,
    platform: body.platform,
    deviceId: body.deviceId,
  });
  return jsonOk(snapshot, { requestId });
});
