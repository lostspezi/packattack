import { runRedisCommand } from "@/lib/redis";

interface RateLimitInput {
  /** Stable bucket key, already namespaced (e.g. `fairness:rotate:<userId>`). */
  bucket: string;
  /** Max requests per window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Simple fixed-window request limiter backed by Redis. Uses a single
 * atomic INCR-with-EXPIRE-on-first-hit Lua call so concurrent hits can't
 * race the TTL. On Redis failure the call fails OPEN (request allowed) —
 * consistent with the rest of the app's runRedisCommand pattern, where
 * availability beats strict correctness on soft limits.
 */
export async function checkRateLimit({
  bucket,
  limit,
  windowSeconds,
}: RateLimitInput): Promise<RateLimitResult> {
  const key = `rl:${bucket}`;
  const count = await runRedisCommand<number>(`rl:${bucket}`, 0, async (redis) => {
    const result = await redis.eval(
      `local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c`,
      1,
      key,
      String(windowSeconds),
    );
    return Number(result) || 0;
  });

  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: allowed ? 0 : windowSeconds,
  };
}
