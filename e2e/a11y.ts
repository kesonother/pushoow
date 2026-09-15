import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

function formatViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `  ${node.target.join(" ")}: ${node.failureSummary ?? node.html}`)
        .join("\n");
      return `${violation.id} (${violation.impact}): ${violation.help}\n${nodes}`;
    })
    .join("\n\n");
}

export async function expectWcag22Aa(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("#nextjs-portal")
    .analyze();
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

export async function expectScreenReaderLandmarks(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", /./);
  await expect(page.getByRole("navigation").first()).toBeAttached();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

export async function expectKeyboardSkipLink(page: Page) {
  await page.keyboard.press("Tab");
  const skip = page.locator("a[href='#content']");
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#content")).toBeVisible();
}
