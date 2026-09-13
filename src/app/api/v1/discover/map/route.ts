import { compactSearchParams, discoverQuerySchema, filtersFromQuery } from "@/api/discovery-schemas";
import { publicDiscoveryMap } from "@/api/discovery-view";
import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ url, requestId }) => {
    const query = discoverQuerySchema.parse(compactSearchParams(url.searchParams));
    return jsonOk(publicDiscoveryMap(await getServices().discovery.map(filtersFromQuery(query))), { requestId });
  },
  { auth: "optional" },
);
