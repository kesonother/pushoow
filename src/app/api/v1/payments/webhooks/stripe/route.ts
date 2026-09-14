import { jsonOk, withApi } from "@/api/handler";
import { ValidationError } from "@/domain/errors";
import { getServices } from "@/server/container";

export const POST = withApi(
  async ({ request, requestId }) => {
    const signature = request.headers.get("stripe-signature") ?? "";
    if (!signature) throw new ValidationError("Missing Stripe signature");
    const payload = await request.text();
    const result = await getServices().payments.handleStripeWebhook(payload, signature);
    return jsonOk(result, { requestId });
  },
  { auth: "none", rateLimit: { limit: 120, windowMs: 60_000 } },
);
