import { DomainError } from "@/domain/errors";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
};

export function toApiError(error: unknown, requestId: string): {
  status: number;
  body: ApiErrorBody;
} {
  if (error instanceof DomainError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL",
        message: "An unexpected error occurred",
        requestId,
      },
    },
  };
}

export function jsonError(error: unknown, requestId: string): Response {
  const mapped = toApiError(error, requestId);
  return Response.json(mapped.body, {
    status: mapped.status,
    headers: {
      "x-request-id": requestId,
    },
  });
}
