import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_TAX_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  PLATFORM_FEE_BPS: z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : Number(value)),
    z.number().int().min(0).max(10_000).optional(),
  ),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cached) return cached;
  cached = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    APP_URL: process.env.APP_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_TAX_ENABLED: process.env.STRIPE_TAX_ENABLED,
    PLATFORM_FEE_BPS: process.env.PLATFORM_FEE_BPS,
  });
  return cached;
}

export function requireDatabaseUrl(): string {
  const url = getEnv().DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  return url;
}

export function resetEnvCache() {
  cached = undefined;
}
