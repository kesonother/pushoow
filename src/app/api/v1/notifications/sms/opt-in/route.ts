import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

const schema = z.object({ phone: z.string().min(8).max(20) });

export const POST = withApi(async ({ user, request, requestId }) => {
  const body = schema.parse(await readJson(request));
  const consent = await getServices().notifications.optInSms({
    phone: body.phone,
    userId: user!.id,
    source: "profile",
  });
  return jsonOk(consent, { requestId });
});
