import { jsonOk, withApi } from "@/api/handler";
import { listCalendarTemplates } from "@/domain/onboarding/templates";

export const GET = withApi(async ({ requestId }) => jsonOk(listCalendarTemplates(), { requestId }), {
  auth: "none",
});
