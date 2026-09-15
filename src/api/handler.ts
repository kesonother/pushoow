import { ZodError } from "zod";
import { jsonError } from "@/api/errors";
import { consumeRateLimit } from "@/api/rate-limit";
import { ValidationError } from "@/domain/errors";
import { cuidGenerator } from "@/lib/ids";
import { requestLogger } from "@/lib/logger";
import { getEnv } from "@/lib/env";
import { recordHttpRequest } from "@/observability/events";
import { tenantFromPath } from "@/observability/refs";

export type ApiUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  emailVerified: boolean;
};

export type ApiContext = {
  request: Request;
  requestId: string;
  url: URL;
  user: ApiUser | null;
};

type HandlerOptions = {
  auth?: "required" | "optional" | "none";
  rateLimit?: {
    limit: number;
    windowMs: number;
    key?: (ctx: ApiContext) => string;
  };
};

function requestIdFrom(request: Request): string {
  return request.headers.get("x-request-id") ?? cuidGenerator.id();
}

function assertSafeOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return;
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowed = getEnv().APP_URL ?? getEnv().BETTER_AUTH_URL ?? "http://localhost:3000";
  if (origin !== allowed && origin !== new URL(request.url).origin) {
    throw new ValidationError("Invalid request origin");
  }
}

export function withApi(
  handler: (ctx: ApiContext) => Promise<Response>,
  options: HandlerOptions = {},
) {
  const authMode = options.auth ?? "required";

  return async (request: Request) => {
    const requestId = requestIdFrom(request);
    const pathname = new URL(request.url).pathname;
    const startedAt = Date.now();
    let user: ApiUser | null = null;
    const log = () =>
      requestLogger({
        requestId,
        userId: user?.id,
        tenantId: tenantFromPath(pathname),
        service: "api",
        path: pathname,
      });

    try {
      assertSafeOrigin(request);

      if (authMode !== "none") {
        const { requireUser } = await import("@/auth/session");
        if (authMode === "required") {
          const sessionUser = await requireUser(request);
          user = {
            id: sessionUser.id,
            email: sessionUser.email,
            name: sessionUser.name,
            emailVerified: sessionUser.emailVerified,
          };
        } else {
          try {
            const sessionUser = await requireUser(request);
            user = {
              id: sessionUser.id,
              email: sessionUser.email,
              name: sessionUser.name,
              emailVerified: sessionUser.emailVerified,
            };
          } catch {
            user = null;
          }
        }
      }

      const ctx: ApiContext = {
        request,
        requestId,
        url: new URL(request.url),
        user,
      };

      if (options.rateLimit) {
        const key = options.rateLimit.key?.(ctx) ?? `${ctx.url.pathname}:${user?.id ?? "anon"}`;
        consumeRateLimit({
          key,
          limit: options.rateLimit.limit,
          windowMs: options.rateLimit.windowMs,
        });
      }

      const response = await handler(ctx);
      response.headers.set("x-request-id", requestId);
      recordHttpRequest({
        pathname,
        status: response.status,
        startedAt,
        requestId,
        userId: user?.id,
        log: log(),
      });
      return response;
    } catch (error) {
      const mapped =
        error instanceof ZodError
          ? new ValidationError("Invalid request body", { issues: error.flatten() })
          : error;
      const response = jsonError(mapped, requestId);
      recordHttpRequest({
        pathname,
        status: response.status,
        startedAt,
        requestId,
        userId: user?.id,
        error: mapped,
        log: log(),
      });
      return response;
    }
  };
}

export function jsonOk<T>(data: T, init?: { status?: number; requestId?: string }) {
  return Response.json(
    { data },
    {
      status: init?.status ?? 200,
      headers: init?.requestId ? { "x-request-id": init.requestId } : undefined,
    },
  );
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}
