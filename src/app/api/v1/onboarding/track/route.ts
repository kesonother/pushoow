import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { getServices } from "@/server/container";

const schema = z.object({
  name: z.enum(["first_event", "share"]),
  organizationId: z.string().optional(),
});

export const POST = withApi(
  async ({ user, request, requestId }) => {
    const body = schema.parse(await readJson(request));
    await getServices().onboarding.track({
      userId: user!.id,
      name: body.name,
      organizationId: body.organizationId,
    });
    return jsonOk({ tracked: true }, { requestId });
  },
  { rateLimit: { limit: 30, windowMs: 60_000 } },
);
