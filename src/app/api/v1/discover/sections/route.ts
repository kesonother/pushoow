import { publicDiscoverySections } from "@/api/discovery-view";
import { jsonOk, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ requestId }) => jsonOk(publicDiscoverySections(await getServices().discovery.sections()), { requestId }),
  { auth: "optional" },
);
