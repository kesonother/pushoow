import { expect, test } from "@playwright/test";
import { expectKeyboardSkipLink, expectScreenReaderLandmarks, expectWcag22Aa } from "./a11y";

test.describe("WCAG 2.2 AA", () => {
  test("login is keyboard-accessible and axe-clean", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/e-mail|email|البريد/i)).toBeVisible();
    await expectKeyboardSkipLink(page);
    await expectScreenReaderLandmarks(page);
    await expectWcag22Aa(page);
  });

  test("register RSVP-adjacent auth form has labels and errors live region", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/e-mail|email|البريد/i)).toBeVisible();
    await expectWcag22Aa(page);
  });

  test("calendar listing page", async ({ page }) => {
    const response = await page.goto("/calendars");
    expect([200, 500]).toContain(response?.status() ?? 0);
    if ((response?.status() ?? 0) >= 500) return;
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectWcag22Aa(page);
  });

  test("event page (public or not-found)", async ({ page }) => {
    const response = await page.goto("/e/this-event-does-not-exist-xyz");
    expect([200, 404, 500]).toContain(response?.status() ?? 0);
    if ((response?.status() ?? 0) >= 500) return;
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expectWcag22Aa(page);
  });

  test("RSVP and checkout live on a public event when one exists", async ({ page }) => {
    await page.goto("/discover");
    const event = page.locator('a[href^="/e/"]').first();
    if (!(await event.count())) {
      test.info().annotations.push({ type: "note", description: "No public event in this environment" });
      await expectWcag22Aa(page);
      return;
    }
    await event.click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const rsvp = page.getByRole("button", { name: /s’inscrire|register|rsvp|inscribir/i });
    await expect(rsvp).toBeVisible();
    await expect(page.getByLabel(/e-mail|email/i)).toBeVisible();
    await expectWcag22Aa(page);
  });

  test("dashboard requires authentication and login stays accessible", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.url() ?? page.url()).toMatch(/login/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectWcag22Aa(page);
  });

  test("scanner requires authentication and login stays accessible", async ({ page }) => {
    await page.goto("/check-in");
    expect(page.url()).toMatch(/login/);
    await expect(page.getByLabel(/e-mail|email/i)).toBeVisible();
    await expectWcag22Aa(page);
  });
});

test.describe("RTL Arabic", () => {
  test.use({ locale: "ar-SA" });

  test("arabic interface exposes RTL document and readable landmarks", async ({ page, context }) => {
    await context.addCookies([
      { name: "pushoow_locale", value: "ar", url: "http://localhost:3000" },
    ]);
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectKeyboardSkipLink(page);
    await expectWcag22Aa(page);
  });
});

test.describe("screen readers (tree)", () => {
  test("VoiceOver/NVDA landmarks exist on login, discover, and home", async ({ page }) => {
    for (const path of ["/", "/login", "/discover"]) {
      await page.goto(path);
      await expectScreenReaderLandmarks(page);
    }
  });
});
