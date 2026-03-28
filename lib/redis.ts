import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const cached = global as typeof globalThis & { redis?: Redis | null };
if (cached.redis === undefined) {
  cached.redis = null;
}

function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 2) return null;
      return Math.min(times * 200, 1000);
    },
  });

  client.on("error", (err) => {
    console.warn("[redis] Connection error:", err.message);
  });

  client.on("end", () => {
    if (cached.redis === client) {
      cached.redis = null;
    }
  });

  return client;
}

function needsNewClient(client: Redis | null | undefined): boolean {
  if (!client) return true;
  return client.status === "end" || client.status === "close";
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getRedis(): Redis {
  if (needsNewClient(cached.redis)) {
    cached.redis = createRedisClient();
  }

  return cached.redis as Redis;
}

export async function runRedisCommand<T>(
  label: string,
  fallback: T,
  command: (redis: Redis) => Promise<T>
): Promise<T> {
  try {
    return await command(getRedis());
  } catch (error) {
    console.warn(`[redis] ${label} failed: ${describeError(error)}`);
    return fallback;
  }
}
