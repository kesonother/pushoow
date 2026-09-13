import { ZodError } from "zod";
import { jsonError } from "@/api/errors";
import { consumeRateLimit } from "@/api/rate-limit";
import { ValidationError } from "@/domain/errors";
import { cuidGenerator } from "@/lib/ids";
import { childLogger } from "@/lib/logger";
import { getEnv } from "@/lib/env";

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
    const log = childLogger({ requestId, path: new URL(request.url).pathname });

    try {
      assertSafeOrigin(request);

      let user: ApiUser | null = null;
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
      return response;
    } catch (error) {
      if (error instanceof ZodError) {
        log.warn({ issues: error.issues }, "Validation failed");
        return jsonError(
          new ValidationError("Invalid request body", { issues: error.flatten() }),
          requestId,
        );
      }

      if (error instanceof ValidationError || (error && typeof error === "object" && "status" in error && (error as { status: number }).status < 500)) {
        log.warn({ err: error }, "Handled API error");
      } else {
        log.error({ err: error }, "Unhandled API error");
      }
      return jsonError(error, requestId);
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
