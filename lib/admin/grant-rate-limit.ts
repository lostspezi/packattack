import { runRedisCommand } from "@/lib/redis";

export const ADMIN_GRANT_LIMIT = 30;
const WINDOW_SECONDS = 60;

export interface GrantRateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Rate-Limit für Admin-Grant-Endpoints: maximal 30 Grants pro Minute pro
 * Admin-Konto. Bei Redis-Ausfall wird denied (fail-closed), damit ein
 * kompromittiertes Admin-Konto die Wirtschaft nicht bei Redis-Flaps
 * unlimitiert drucken kann.
 */
export async function checkAdminGrantRate(adminUserId: string): Promise<GrantRateLimitResult> {
  const key = `rl:admin-grant:${adminUserId}`;

  const count = await runRedisCommand<number>(
    `admin-grant:${adminUserId}`,
    -1,
    async (redis) => {
      const result = await redis.eval(
        `local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count`,
        1,
        key,
        String(WINDOW_SECONDS),
      );
      return Number(result) || 0;
    },
  );

  if (count === -1) {
    return {
      allowed: false,
      used: 0,
      limit: ADMIN_GRANT_LIMIT,
      remaining: 0,
      retryAfterSeconds: WINDOW_SECONDS,
    };
  }

  const allowed = count <= ADMIN_GRANT_LIMIT;
  return {
    allowed,
    used: count,
    limit: ADMIN_GRANT_LIMIT,
    remaining: Math.max(0, ADMIN_GRANT_LIMIT - count),
    retryAfterSeconds: allowed ? 0 : WINDOW_SECONDS,
  };
}
