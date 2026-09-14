import { ZodError } from "zod";
import { jsonError } from "@/api/errors";
import { consumeRateLimit } from "@/api/rate-limit";
import { UnauthorizedError, ValidationError } from "@/domain/errors";
import { isSupportedPublicVersion, publicApiVersionHeaders } from "@/domain/public-api/version";
import type { PublicApiScope, PublicPrincipal } from "@/domain/public-api/types";
import { getServices } from "@/server/container";
import { cuidGenerator } from "@/lib/ids";
import { childLogger } from "@/lib/logger";

export type PublicApiContext = {
  request: Request;
  requestId: string;
  url: URL;
  principal: PublicPrincipal | null;
};

type PublicHandlerOptions = {
  auth?: "required" | "none";
  scope?: PublicApiScope;
};

export function withPublicApi(
  handler: (ctx: PublicApiContext) => Promise<Response>,
  options: PublicHandlerOptions = {},
) {
  const authMode = options.auth ?? "required";
  return async (request: Request) => {
    const requestId = request.headers.get("x-request-id") ?? cuidGenerator.id();
    const url = new URL(request.url);
    const log = childLogger({ requestId, path: url.pathname });
    try {
      if (!isSupportedPublicVersion(request.headers.get("api-version"))) {
        throw new ValidationError("Unsupported API version");
      }
      let principal: PublicPrincipal | null = null;
      if (authMode === "required") {
        principal = await getServices().publicApi.authenticate(
          request.headers.get("authorization"),
          request.headers.get("x-api-key"),
        );
        if (options.scope) getServices().publicApi.assertScope(principal, options.scope);
        const limit = consumeRateLimit({
          key: `public:${principal.organizationId}`,
          limit: principal.rateLimitPerMinute,
          windowMs: 60_000,
        });
        const response = await handler({ request, requestId, url, principal });
        applyPublicHeaders(response, requestId, limit);
        return withCors(request, response);
      }
      const response = await handler({ request, requestId, url, principal });
      applyPublicHeaders(response, requestId);
      return withCors(request, response);
    } catch (error) {
      if (error instanceof ZodError) {
        return withCors(
          request,
          withPublicHeaders(
            jsonError(new ValidationError("Invalid request body", { issues: error.flatten() }), requestId),
            requestId,
          ),
        );
      }
      if (error instanceof UnauthorizedError || (error && typeof error === "object" && "status" in error)) {
        log.warn({ err: error }, "Public API error");
      } else {
        log.error({ err: error }, "Public API failure");
      }
      return withCors(request, withPublicHeaders(jsonError(error, requestId), requestId));
    }
  };
}

function applyPublicHeaders(
  response: Response,
  requestId: string,
  limit?: { limit: number; remaining: number; resetAt: number },
) {
  response.headers.set("x-request-id", requestId);
  for (const [key, value] of Object.entries(publicApiVersionHeaders())) {
    response.headers.set(key, value);
  }
  if (limit) {
    response.headers.set("x-ratelimit-limit", String(limit.limit));
    response.headers.set("x-ratelimit-remaining", String(limit.remaining));
    response.headers.set("x-ratelimit-reset", String(Math.ceil(limit.resetAt / 1000)));
  }
}

function withPublicHeaders(response: Response, requestId: string) {
  applyPublicHeaders(response, requestId);
  return response;
}

function withCors(request: Request, response: Response) {
  const origin = request.headers.get("origin");
  if (origin) {
    response.headers.set("access-control-allow-origin", origin);
    response.headers.set("vary", "Origin");
  } else {
    response.headers.set("access-control-allow-origin", "*");
  }
  response.headers.set("access-control-allow-headers", "Authorization, Content-Type, X-Api-Key, Api-Version");
  response.headers.set("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
  return response;
}

export function publicOptions() {
  return withPublicApi(async () => new Response(null, { status: 204 }), { auth: "none" });
}
