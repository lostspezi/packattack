import { getRedis } from "@/lib/redis";

const CACHE_KEY = "exchange:usd_eur";
const CACHE_TTL = 3600; // 1 hour

let memoryCache: { rate: number; ts: number } | null = null;

/**
 * Get current USD → EUR exchange rate.
 * Cached in Redis (1h) with in-memory fallback.
 */
export async function getUsdToEur(): Promise<number> {
  // In-memory cache (5 min) to avoid Redis calls on every render
  if (memoryCache && Date.now() - memoryCache.ts < 300_000) {
    return memoryCache.rate;
  }

  const redis = getRedis();

  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      const rate = parseFloat(cached);
      memoryCache = { rate, ts: Date.now() };
      return rate;
    }
  } catch {
    // Redis unavailable, continue to fetch
  }

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { rates?: { EUR?: number } };
    const rate = data.rates?.EUR ?? 0.92; // fallback

    memoryCache = { rate, ts: Date.now() };

    try {
      await redis.set(CACHE_KEY, String(rate), "EX", CACHE_TTL);
    } catch {
      // Redis write failed, no problem
    }

    return rate;
  } catch {
    // API failed, use fallback
    return memoryCache?.rate ?? 0.92;
  }
}
