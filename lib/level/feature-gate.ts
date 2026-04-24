import connectDB from "@/lib/db";
import Achievement from "@/models/achievement";
import { runRedisCommand } from "@/lib/redis";

const CACHE_KEY = "level-system:has-active-achievement";
const CACHE_TTL_SECONDS = 60;

/**
 * Gibt zurück, ob das Level-/XP-System aktiv ist. Aktiv heißt: es existiert
 * mindestens ein Achievement mit `active: true`. Solange das nicht der Fall
 * ist, wird kein XP vergeben und kein Counter inkrementiert. Verhindert,
 * dass User vor dem Live-Schalten "still" XP farmen und bei der nächsten
 * Achievement-Anlage retroaktiv Belohnungen kassieren.
 *
 * Ergebnis wird in Redis gecached (60s). Bei Achievement-Create/Update/Delete
 * sollte der Cache via `invalidateLevelSystemGate()` zurückgesetzt werden,
 * damit der Live-Schalter sofort greift und nicht erst nach Ablauf.
 */
export async function isLevelSystemActive(): Promise<boolean> {
  const cached = await runRedisCommand<string | null>(
    "level-gate:get",
    null,
    async (redis) => (await redis.get(CACHE_KEY)) ?? null,
  );
  if (cached === "1") return true;
  if (cached === "0") return false;

  await connectDB();
  const exists = await Achievement.exists({ active: true });
  const value = exists ? "1" : "0";

  await runRedisCommand<void>("level-gate:set", undefined, async (redis) => {
    await redis.set(CACHE_KEY, value, "EX", CACHE_TTL_SECONDS);
  });

  return Boolean(exists);
}

export async function invalidateLevelSystemGate(): Promise<void> {
  await runRedisCommand<void>("level-gate:del", undefined, async (redis) => {
    await redis.del(CACHE_KEY);
  });
}
