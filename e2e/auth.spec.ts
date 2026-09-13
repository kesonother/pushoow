import { expect, test } from "@playwright/test";

test("login exposes magic link and optional password, not a forced password", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /connexion|log in/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /lien de connexion|sign-in link/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /mot de passe|password/i })).toBeVisible();
  await expect(page.getByLabel(/e-mail|email/i)).toBeVisible();
});

test("profile requires authentication", async ({ page }) => {
  const response = await page.goto("/profile");
  expect(response?.url() ?? page.url()).toContain("/login");
});

test("unauthenticated identity APIs are rejected", async ({ request }) => {
  const me = await request.get("/api/v1/me");
  expect(me.status()).toBe(401);
  const refresh = await request.post("/api/v1/auth/refresh", {
    data: { refreshToken: "not-a-real-token-value" },
  });
  expect([401, 422]).toContain(refresh.status());
});
