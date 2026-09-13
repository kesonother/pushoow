import { headers } from "next/headers";
import { UnauthorizedError } from "@/domain/errors";
import { auth } from "@/auth/server";
import { getServices } from "@/server/container";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  emailVerified: boolean;
  image?: string | null;
};

async function userFromAccessToken(request: Request): Promise<SessionUser | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  const services = getServices();
  const claims = await services.tokens.verifyAccessToken(token);
  const directoryUser = await services.users.findById(claims.sub);
  if (!directoryUser) return null;
  return {
    id: directoryUser.id,
    email: directoryUser.email,
    emailVerified: directoryUser.emailVerified,
    name: null,
  };
}

function hasAuthMaterial(headerList: Headers) {
  const cookie = headerList.get("cookie") ?? "";
  const hasSessionCookie =
    cookie.includes("better-auth.session_token") ||
    cookie.includes("__Secure-better-auth.session_token");
  const hasBearer = headerList.get("authorization")?.startsWith("Bearer ");
  return Boolean(hasSessionCookie || hasBearer);
}

export async function getSession(request?: Request) {
  const headerList = request?.headers ?? (await headers());
  if (!hasAuthMaterial(headerList)) {
    return null;
  }

  if (request) {
    const fromBearer = await userFromAccessToken(request).catch(() => null);
    if (fromBearer) return { user: fromBearer };
  }

  return auth.api.getSession({
    headers: headerList,
  });
}

export async function requireUser(request?: Request): Promise<SessionUser> {
  const session = await getSession(request);
  const user = session?.user;
  if (!user?.id) {
    throw new UnauthorizedError();
  }

  const services = getServices();
  await services.moderation.assertActive(user.id);

  return {
    id: user.id,
    email: user.email,
    name: "name" in user ? user.name : null,
    emailVerified: Boolean("emailVerified" in user ? user.emailVerified : false),
    image: "image" in user ? user.image : null,
  };
}
