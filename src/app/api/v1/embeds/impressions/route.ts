import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { isEmbedKind } from "@/domain/embed/service";
import { getServices } from "@/server/container";

const schema = z.object({
  kind: z.string(),
  resourceId: z.string().min(1).max(80),
  track: z.boolean().optional(),
});

export const POST = withApi(
  async ({ request, requestId }) => {
    const body = schema.parse(await readJson(request));
    if (!isEmbedKind(body.kind)) {
      return jsonOk({ recorded: false, reason: "invalid" }, { requestId });
    }
    const result = await getServices().embeds.recordImpression({
      kind: body.kind,
      resourceId: body.resourceId,
      track: body.track === true,
    });
    return jsonOk(result, { requestId });
  },
  { auth: "none", rateLimit: { limit: 60, windowMs: 60_000 } },
);
