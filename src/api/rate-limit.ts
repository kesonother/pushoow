import { RateLimitedError } from "@/domain/errors";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export type RateLimitState = {
  limit: number;
  remaining: number;
  resetAt: number;
};

export function consumeRateLimit(options: RateLimitOptions): RateLimitState {
  const now = options.now ?? Date.now();
  const current = buckets.get(options.key);

  if (!current || current.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return { limit: options.limit, remaining: options.limit - 1, resetAt: now + options.windowMs };
  }

  if (current.count >= options.limit) {
    throw new RateLimitedError();
  }

  current.count += 1;
  return { limit: options.limit, remaining: options.limit - current.count, resetAt: current.resetAt };
}

export function resetRateLimits() {
  buckets.clear();
}
