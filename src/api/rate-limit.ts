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

export function consumeRateLimit(options: RateLimitOptions): void {
  const now = options.now ?? Date.now();
  const current = buckets.get(options.key);

  if (!current || current.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  if (current.count >= options.limit) {
    throw new RateLimitedError();
  }

  current.count += 1;
}

export function resetRateLimits() {
  buckets.clear();
}
