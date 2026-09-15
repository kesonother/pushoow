import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/health/live/route";

describe("GET /api/v1/health/live", () => {
  it("returns a liveness payload", async () => {
    const response = await GET(new Request("http://localhost/api/v1/health/live"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.live).toBe(true);
    expect(body.data.service).toBe("pushoow");
  });
});
