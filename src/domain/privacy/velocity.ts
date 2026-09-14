import { RateLimitedError } from "@/domain/errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function incrementVelocity(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): number {
  const now = input.now ?? Date.now();
  const current = buckets.get(input.key);
  if (!current || current.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return 1;
  }
  current.count += 1;
  if (current.count > input.limit) {
    throw new RateLimitedError();
  }
  return current.count;
}

export function resetVelocity() {
  buckets.clear();
}
