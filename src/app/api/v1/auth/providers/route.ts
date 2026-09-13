import { enabledOAuthProviders } from "@/auth/providers";
import { jsonOk, withApi } from "@/api/handler";

export const GET = withApi(
  async ({ requestId }) =>
    jsonOk(
      {
        password: true,
        magicLink: true,
        oauth: enabledOAuthProviders(),
      },
      { requestId },
    ),
  { auth: "none" },
);
