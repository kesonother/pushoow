import { withPublicApi } from "@/api/public-handler";
import { getSession } from "@/auth/session";
import { ForbiddenError, ValidationError } from "@/domain/errors";
import { getServices } from "@/server/container";

export const GET = withPublicApi(
  async ({ request, url }) => {
    const clientId = url.searchParams.get("client_id") ?? "";
    const redirectUri = url.searchParams.get("redirect_uri") ?? "";
    const responseType = url.searchParams.get("response_type") ?? "";
    const codeChallenge = url.searchParams.get("code_challenge") ?? "";
    const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "S256";
    const state = url.searchParams.get("state") ?? "";
    if (responseType !== "code") throw new ValidationError("response_type must be code");

    const session = await getSession(request);
    if (!session?.user) {
      const next = `/v1/oauth/authorize?${url.searchParams.toString()}`;
      return Response.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));
    }

    const services = getServices();
    const client = await services.publicApi.findClient(clientId);
    if (!client) throw new ValidationError("Unknown OAuth client");
    const memberships = await services.memberships.listByUser(session.user.id);
    if (!memberships.some((item) => item.organizationId === client.organizationId)) {
      throw new ForbiddenError("You must belong to the OAuth client organization");
    }

    const { code } = await services.publicApi.authorize({
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      userId: session.user.id,
      organizationId: client.organizationId,
    });
    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);
    return Response.redirect(target);
  },
  { auth: "none" },
);
