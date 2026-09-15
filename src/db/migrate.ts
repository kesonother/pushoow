import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env";

try {
  process.loadEnvFile(".env.local");
} catch {
  // DATABASE_URL can also come from the process environment.
}

const RETRYABLE = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "CONNECTION_CLOSED"]);
const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 500;

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const withCause = error as { code?: unknown; cause?: { code?: unknown } };
  if (typeof withCause.code === "string") return withCause.code;
  if (typeof withCause.cause?.code === "string") return withCause.cause.code;
  return undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function migrateOnce() {
  const client = postgres(requireDatabaseUrl(), { max: 1, connect_timeout: 10 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle/migrations" });
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function main() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await migrateOnce();
      return;
    } catch (error) {
      lastError = error;
      const code = errorCode(error);
      if (!code || !RETRYABLE.has(code) || attempt === MAX_ATTEMPTS) throw error;
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
  throw lastError;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
