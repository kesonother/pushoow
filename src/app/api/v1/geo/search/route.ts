import { z } from "zod";
import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ url, requestId }) => {
    const query = z.string().min(2).parse(url.searchParams.get("q"));
    const results = await getServices().geocoder.search(query);
    return jsonOk(results, { requestId });
  },
  { auth: "optional", rateLimit: { limit: 20, windowMs: 60_000 } },
);
