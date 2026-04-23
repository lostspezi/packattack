import { runRedisCommand } from "@/lib/redis";

export const PACKI_DAILY_LIMIT = 20;
const DAY_SECONDS = 60 * 60 * 24;

export interface PackiRateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function secondsUntilNextUtcDay(now: Date = new Date()): number {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(1, Math.floor((next.getTime() - now.getTime()) / 1000));
}

export async function assertPackiMessageAllowed(
  userId: string,
  now: Date = new Date(),
): Promise<PackiRateLimitResult> {
  const dayKey = utcDayKey(now);
  const key = `packi:rate:${userId}:${dayKey}`;
  const retryAfterSeconds = secondsUntilNextUtcDay(now);

  const count = await runRedisCommand<number>(
    `packi:rate:${userId}`,
    0,
    async (redis) => {
      const result = await redis.eval(
        `local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count`,
        1,
        key,
        String(DAY_SECONDS),
      );
      return Number(result) || 0;
    },
  );

  if (count === 0) {
    return {
      allowed: true,
      used: 0,
      limit: PACKI_DAILY_LIMIT,
      remaining: PACKI_DAILY_LIMIT,
      retryAfterSeconds: 0,
    };
  }

  const allowed = count <= PACKI_DAILY_LIMIT;
  return {
    allowed,
    used: count,
    limit: PACKI_DAILY_LIMIT,
    remaining: Math.max(0, PACKI_DAILY_LIMIT - count),
    retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
  };
}
