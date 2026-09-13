import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/health/route";

describe("GET /api/v1/health", () => {
  it("returns a public health payload", async () => {
    const response = await GET(new Request("http://localhost/api/v1/health"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("ok");
    expect(body.data.service).toBe("pushoow");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });
});
