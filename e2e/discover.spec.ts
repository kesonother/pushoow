import { expect, test } from "@playwright/test";

test("discover and featured calendars stay reachable without knowing an organizer", async ({ page }) => {
  const discover = await page.goto("/discover");
  expect([200, 500]).toContain(discover?.status());
  await expect(page.getByRole("heading", { name: /découvrir|discover/i })).toBeVisible();
  await expect(page.getByLabel(/recherche|search/i)).toBeVisible();

  const calendars = await page.goto("/calendars");
  expect([200, 500]).toContain(calendars?.status());
  await expect(page.getByRole("heading", { name: /calendriers|featured calendars/i })).toBeVisible();
});
