import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const cached = global as typeof globalThis & { redis: Redis | null };
if (!cached.redis) cached.redis = null;

export function getRedis(): Redis {
  if (!cached.redis) {
    cached.redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    cached.redis.on("error", (err) => {
      console.warn("[redis] Connection error:", err.message);
    });
  }
  return cached.redis;
}
