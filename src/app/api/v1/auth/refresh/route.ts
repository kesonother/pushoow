import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const POST = withApi(
  async ({ request, requestId }) => {
    const body = refreshSchema.parse(await readJson(request));
    const services = getServices();
    const pair = await services.tokens.refresh(body.refreshToken);
    return jsonOk(pair, { requestId });
  },
  {
    auth: "none",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
);
