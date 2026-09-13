import { compactSearchParams, discoverQuerySchema, filtersFromQuery } from "@/api/discovery-schemas";
import { publicDiscoveryPage } from "@/api/discovery-view";
import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ url, requestId }) => {
    const query = discoverQuerySchema.parse(compactSearchParams(url.searchParams));
    const page = await getServices().discovery.discover(filtersFromQuery(query));
    return jsonOk(publicDiscoveryPage(page), { requestId });
  },
  { auth: "optional", rateLimit: { limit: 60, windowMs: 60_000 } },
);
