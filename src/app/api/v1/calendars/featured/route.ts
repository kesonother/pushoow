import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ requestId }) => jsonOk(await getServices().discovery.featuredCalendars(), { requestId }),
  { auth: "optional" },
);
