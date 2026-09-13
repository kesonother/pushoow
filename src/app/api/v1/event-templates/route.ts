import { jsonOk, withApi } from "@/api/handler";
import { listEventTemplates } from "@/domain/event/templates";

export const GET = withApi(
  async ({ requestId }) => jsonOk(listEventTemplates(), { requestId }),
  { auth: "none" },
);
