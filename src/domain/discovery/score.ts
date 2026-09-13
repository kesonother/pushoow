export type TrendingSignals = {
  recentRegs7d: number;
  previousRegs7d: number;
  velocity48h: number;
  followerCount: number;
  featured: boolean;
};

export function trendingScore(signals: TrendingSignals): number {
  const growth = signals.recentRegs7d - signals.previousRegs7d;
  return (
    signals.recentRegs7d * 3 +
    Math.max(0, growth) * 2 +
    signals.velocity48h * 4 +
    Math.floor(Math.max(0, signals.followerCount) / 10) +
    (signals.featured ? 5 : 0)
  );
}

export function countInWindow(
  dates: Date[],
  now: Date,
  windowMs: number,
  offsetMs = 0,
): number {
  const end = now.getTime() - offsetMs;
  const start = end - windowMs;
  return dates.filter((date) => {
    const time = date.getTime();
    return time > start && time <= end;
  }).length;
}

type CacheEntry<T> = { value: T; expiresAt: number };

export function createTtlCache<T>(ttlMs: number) {
  const items = new Map<string, CacheEntry<T>>();
  return {
    get(key: string, now: Date): T | null {
      const hit = items.get(key);
      if (!hit || hit.expiresAt <= now.getTime()) {
        if (hit) items.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key: string, value: T, now: Date) {
      items.set(key, { value, expiresAt: now.getTime() + ttlMs });
    },
    clear() {
      items.clear();
    },
  };
}
