/**
 * Small fixed-window rate limiter kept in memory. Good enough for one server process
 * (the public demo runs a single instance); counts reset when the process restarts.
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window ends (for the Retry-After header). */
  retryAfterSec: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records one hit for `key` and says whether it is within the limit. */
  hit(key: string): RateLimitResult {
    const now = this.now();
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
      if (this.hits.size > 10_000) this.prune(now);
    }
    entry.count++;
    return { allowed: entry.count <= this.max, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }

  private prune(now: number): void {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}
