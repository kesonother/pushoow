import { getEnv } from "@/lib/env";
import { getServices } from "@/server/container";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const appUrl = getEnv().APP_URL ?? getEnv().BETTER_AUTH_URL ?? "http://localhost:3000";
  try {
    const result = await getServices().integrations.completeOAuth({ code, state });
    return Response.redirect(
      `${appUrl}/dashboard/organizations/${result.organizationId}/integrations?connected=${result.connection.provider}`,
    );
  } catch {
    return Response.redirect(`${appUrl}/dashboard?integration=error`);
  }
}
