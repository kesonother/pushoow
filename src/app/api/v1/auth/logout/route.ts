import { z } from "zod";
import { jsonOk, readJson, withApi } from "@/api/handler";
import { auth } from "@/auth/server";
import { getServices } from "@/server/container";

const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
  familyId: z.string().min(1).optional(),
  all: z.boolean().optional(),
});

export const POST = withApi(async ({ user, request, requestId }) => {
  const body = logoutSchema.parse(await readJson(request).catch(() => ({})));
  const services = getServices();

  if (body.all) {
    await services.tokens.revokeAll(user!.id);
    const { revokeBetterAuthSessions } = await import("@/db/repositories/identity-repo");
    await revokeBetterAuthSessions(services.db, user!.id);
  } else if (body.familyId) {
    await services.tokens.revokeFamily(body.familyId);
  } else if (body.refreshToken) {
    await services.tokens.revokePresented(body.refreshToken);
  }

  await auth.api.signOut({
    headers: request.headers,
  }).catch(() => undefined);

  return jsonOk({ signedOut: true }, { requestId });
});
