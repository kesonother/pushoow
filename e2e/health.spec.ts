import { expect, test } from "@playwright/test";

test("health endpoint is public and structured", async ({ request }) => {
  const response = await request.get("/api/v1/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.data.status).toBe("ok");
  expect(response.headers()["x-request-id"]).toBeTruthy();
});
