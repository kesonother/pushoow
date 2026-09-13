import { compactSearchParams, discoverQuerySchema } from "@/api/discovery-schemas";
import { publicDiscoveryCard } from "@/api/discovery-view";
import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ url, user, requestId }) => {
    const query = discoverQuerySchema.parse(compactSearchParams(url.searchParams));
    const items = await getServices().discovery.recommend({
      userId: user?.id,
      eventId: query.eventId,
    });
    return jsonOk(items.map(publicDiscoveryCard), { requestId });
  },
  { auth: "optional" },
);
