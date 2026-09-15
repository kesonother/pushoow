import { spawnSync } from "node:child_process";

const urls = [
  "/login",
  "/calendars",
  "/discover",
  "/e/this-event-does-not-exist-xyz",
  "/dashboard",
  "/check-in",
];

const origin = process.env.APP_URL ?? "http://localhost:3000";

function audit(path: string) {
  const url = `${origin}${path}`;
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "lighthouse",
      url,
      "--only-categories=accessibility",
      "--quiet",
      "--chrome-flags=--headless",
      "--output=json",
      "--output-path=stdout",
    ],
    { encoding: "utf8", timeout: 120_000 },
  );
  if (result.status !== 0) {
    throw new Error(`Lighthouse failed for ${url}: ${result.stderr || result.stdout}`);
  }
  const report = JSON.parse(result.stdout) as { categories: { accessibility: { score: number } } };
  const score = report.categories.accessibility.score;
  if (score < 0.9) {
    throw new Error(`Lighthouse accessibility score ${(score * 100).toFixed(0)} < 90 on ${url}`);
  }
  console.log(`${path}: ${(score * 100).toFixed(0)}`);
}

for (const path of urls) audit(path);
