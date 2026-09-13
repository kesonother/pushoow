import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/domain/errors";
import { toApiError } from "@/api/errors";

describe("API error mapping", () => {
  it("maps domain errors to structured HTTP payloads", () => {
    const forbidden = toApiError(new ForbiddenError(), "req_1");
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
    expect(forbidden.body.error.requestId).toBe("req_1");
  });

  it("maps not found errors without leaking internals", () => {
    const missing = toApiError(new NotFoundError("Calendar", "cal_1"), "req_2");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
  });

  it("hides unexpected errors behind a generic 500", () => {
    const crash = toApiError(new Error("secret stack"), "req_3");
    expect(crash.status).toBe(500);
    expect(crash.body.error.message).toBe("An unexpected error occurred");
    expect(JSON.stringify(crash.body)).not.toContain("secret stack");
  });
});
