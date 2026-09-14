import { jsonOk, withApi } from "@/api/handler";
import { ValidationError } from "@/domain/errors";
import { getServices } from "@/server/container";

export const GET = withApi(
  async ({ user, url, requestId }) => {
    const target = url.searchParams.get("url")?.trim() ?? "";
    if (!target) throw new ValidationError("url is required");
    return jsonOk(await getServices().mobile.resolveLink(target, user?.id), { requestId });
  },
  { auth: "optional" },
);
