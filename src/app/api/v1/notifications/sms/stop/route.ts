import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

const schema = z.object({ phone: z.string().min(8).max(20), body: z.string().default("STOP") });

export const POST = withApi(
  async ({ request, requestId }) => {
    const body = schema.parse(await readJson(request));
    const result = await getServices().notifications.handleSmsInbound(body.phone, body.body);
    return jsonOk(result, { requestId });
  },
  { auth: "none", rateLimit: { limit: 30, windowMs: 60_000 } },
);
