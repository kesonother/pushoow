import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/health/ready/route";

describe("GET /api/v1/health/ready", () => {
  it("returns a readiness report with dependency checks", async () => {
    const response = await GET(new Request("http://localhost/api/v1/health/ready"));
    expect([200, 503]).toContain(response.status);
    const body = await response.json();
    expect(typeof body.data.ready).toBe("boolean");
    expect(body.data.service).toBe("pushoow");
    expect(body.data.checks.map((check: { name: string }) => check.name)).toEqual(
      expect.arrayContaining(["process", "memory", "database", "queue", "payments", "email"]),
    );
  });
});
