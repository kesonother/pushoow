import { publicDiscoveryPage } from "@/api/discovery-view";
import { intentBodySchema } from "@/api/ai-schemas";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const POST = withApi(
  async ({ request, requestId }) => {
    const body = intentBodySchema.parse(await readJson(request));
    const result = await getServices().ai.searchByIntent(body.query, body.providerId);
    return jsonOk(
      {
        interpretation: {
          query: result.query,
          filters: {
            ...result.filters,
            dateFrom: result.filters.dateFrom?.toISOString(),
            dateTo: result.filters.dateTo?.toISOString(),
          },
          notes: result.notes,
          certainty: result.certainty,
          aiGenerated: result.aiGenerated,
          disclosure: result.disclosure,
          providerId: result.providerId,
        },
        page: publicDiscoveryPage(result.page),
      },
      { requestId },
    );
  },
  { auth: "optional", rateLimit: { limit: 30, windowMs: 60_000 } },
);
