import { expect, test } from "@playwright/test";

test("unknown public event is not found or unavailable without a database", async ({ page }) => {
  const response = await page.goto("/e/this-event-does-not-exist-xyz");
  expect([404, 500]).toContain(response?.status());
});
