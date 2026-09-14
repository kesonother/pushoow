import { publicOptions, withPublicApi } from "@/api/public-handler";
import { publicOpenApiDocument } from "@/domain/public-api/openapi";
import { getEnv } from "@/lib/env";

export const GET = withPublicApi(
  async ({ request }) => {
    const appUrl = getEnv().APP_URL ?? getEnv().BETTER_AUTH_URL ?? new URL(request.url).origin;
    return Response.json(publicOpenApiDocument(appUrl));
  },
  { auth: "none" },
);

export const OPTIONS = publicOptions();
