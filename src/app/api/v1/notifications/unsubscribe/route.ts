import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

const schema = z.object({ token: z.string().min(8) });

export const POST = withApi(
  async ({ request, requestId, url }) => {
    const token = url.searchParams.get("token");
    const body = token ? { token } : schema.parse(await readJson(request));
    const result = await getServices().notifications.unsubscribe(body.token);
    return jsonOk(result, { requestId });
  },
  { auth: "none", rateLimit: { limit: 20, windowMs: 60_000 } },
);
