import { HttpException } from '@nestjs/common';

const buckets = new Map<string, number[]>();

/** Returns false when the caller is over the limit. The hit is not recorded in that case. */
export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

export function assertWithinRate(key: string, limit: number, windowMs: number): void {
  if (!hitRateLimit(key, limit, windowMs)) {
    throw new HttpException('Too many attempts. Wait a moment and try again.', 429);
  }
}

export function clearRateLimits(): void {
  buckets.clear();
}
