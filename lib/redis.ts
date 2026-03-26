import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const cached = global as typeof globalThis & { redis: Redis | null };
if (!cached.redis) cached.redis = null;

export function getRedis(): Redis {
  if (!cached.redis) {
    cached.redis = new Redis(REDIS_URL);
  }
  return cached.redis;
}
