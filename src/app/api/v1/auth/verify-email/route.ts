import { jsonOk, withApi } from "@/api/handler";
import { auth } from "@/auth/server";

export const POST = withApi(
  async ({ user, request, requestId }) => {
    await auth.api.sendVerificationEmail({
      headers: request.headers,
      body: { email: user!.email ?? "", callbackURL: "/dashboard" },
    });
    return jsonOk({ sent: true }, { requestId });
  },
  { rateLimit: { limit: 5, windowMs: 60_000 } },
);
