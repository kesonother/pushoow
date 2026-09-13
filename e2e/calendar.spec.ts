import { expect, test } from "@playwright/test";

test("unknown public calendar is not found", async ({ page }) => {
  const response = await page.goto("/c/this-calendar-does-not-exist-xyz");
  expect([404, 500]).toContain(response?.status());
});

test("calendar feeds reject unknown slugs", async ({ request }) => {
  const ics = await request.get("/c/this-calendar-does-not-exist-xyz/feed/ics");
  expect([404, 500]).toContain(ics.status());
});
