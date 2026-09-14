import { jsonOk } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { PUBLIC_API_DEPRECATION_MONTHS, PUBLIC_API_VERSION } from "@/domain/public-api/types";
import { publicApiVersionPolicy } from "@/domain/public-api/version";

export const GET = withPublicApi(
  async ({ requestId }) =>
    jsonOk(
      {
        version: PUBLIC_API_VERSION,
        deprecationPolicyMonths: PUBLIC_API_DEPRECATION_MONTHS,
        policy: publicApiVersionPolicy(),
        documentation: "/docs/api",
        openapi: "/v1/openapi.json",
      },
      { requestId },
    ),
  { auth: "none" },
);

export const OPTIONS = publicOptions();
