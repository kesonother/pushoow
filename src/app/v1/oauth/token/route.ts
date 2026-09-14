import { readJson } from "@/api/handler";
import { publicOptions, withPublicApi } from "@/api/public-handler";
import { publicOAuthTokenSchema } from "@/api/public-schemas";
import { getServices } from "@/server/container";

async function readTokenInput(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  }
  return readJson<Record<string, unknown>>(request);
}

export const POST = withPublicApi(
  async ({ request, requestId }) => {
    const body = publicOAuthTokenSchema.parse(await readTokenInput(request));
    const token = await getServices().publicApi.token({
      grantType: body.grant_type,
      code: body.code,
      redirectUri: body.redirect_uri,
      clientId: body.client_id,
      clientSecret: body.client_secret,
      codeVerifier: body.code_verifier,
    });
    return Response.json(token, { headers: { "x-request-id": requestId } });
  },
  { auth: "none" },
);

export const OPTIONS = publicOptions();
