import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS } from "@/domain/notification/types";
import { getServices } from "@/server/container";

const patchSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  category: z.enum(NOTIFICATION_CATEGORIES),
  enabled: z.boolean(),
  trackingConsent: z.boolean().optional(),
});

export const GET = withApi(async ({ user, requestId }) => {
  const items = await getServices().notifications.listPreferences(user!.id);
  return jsonOk(items, { requestId });
});

export const PATCH = withApi(async ({ user, requestId, request }) => {
  const body = patchSchema.parse(await readJson(request));
  const preference = await getServices().notifications.setPreference({
    userId: user!.id,
    ...body,
  });
  return jsonOk(preference, { requestId });
});
