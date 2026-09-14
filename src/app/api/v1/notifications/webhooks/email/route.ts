import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { ValidationError } from "@/domain/errors";
import { getServices } from "@/server/container";

const schema = z.object({
  type: z.enum(["bounce", "complaint"]),
  email: z.string().email(),
});

export const POST = withApi(
  async ({ request, requestId }) => {
    const expected = process.env.NOTIFICATION_WEBHOOK_SECRET;
    if (!expected) throw new ValidationError("Email webhook is not configured");
    const provided = request.headers.get("x-webhook-secret") ?? "";
    if (provided !== expected) throw new ValidationError("Invalid webhook secret");
    const body = schema.parse(await readJson(request));
    const notifications = getServices().notifications;
    const result =
      body.type === "bounce"
        ? await notifications.handleBounce(body.email)
        : await notifications.handleComplaint(body.email);
    return jsonOk(result, { requestId });
  },
  { auth: "none", rateLimit: { limit: 60, windowMs: 60_000 } },
);
