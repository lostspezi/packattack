import Redis from "ioredis";
import { getRedis } from "@/lib/redis";

// ---------- Types ----------

export type BattleEventType =
  | "player_joined"
  | "player_left"
  | "ready_check"
  | "player_ready"
  | "battle_start"
  | "round_start"
  | "player_selected"
  | "round_reveal"
  | "battle_end"
  | "battle_cancelled";

export interface BattleEvent {
  type: BattleEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

// ---------- Channel ----------

function channelKey(battleId: string): string {
  return `battle:${battleId}`;
}

// ---------- Publish ----------

export async function publishBattleEvent(
  battleId: string,
  type: BattleEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const event: BattleEvent = { type, data, timestamp: Date.now() };
  try {
    await getRedis().publish(channelKey(battleId), JSON.stringify(event));
  } catch (err) {
    console.warn(`[battle-events] publish failed for ${battleId}:`, err);
  }
}

// ---------- Subscribe ----------

/**
 * Create a dedicated Redis subscriber for a battle channel.
 * Returns subscriber client and cleanup function.
 * IMPORTANT: Must create a new Redis client for subscribing (ioredis requirement).
 */
export function subscribeToBattle(
  battleId: string,
  onMessage: (event: BattleEvent) => void,
): { subscriber: Redis; unsubscribe: () => void } {
  const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
  const subscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 2) return null;
      return Math.min(times * 200, 1000);
    },
  });

  const channel = channelKey(battleId);

  subscriber.subscribe(channel).catch((err) => {
    console.warn(`[battle-events] subscribe failed for ${battleId}:`, err);
  });

  subscriber.on("message", (_ch: string, message: string) => {
    try {
      const event = JSON.parse(message) as BattleEvent;
      onMessage(event);
    } catch {
      // Ignore malformed messages
    }
  });

  const unsubscribe = () => {
    subscriber.unsubscribe(channel).catch(() => {});
    subscriber.disconnect();
  };

  return { subscriber, unsubscribe };
}

// ---------- Distributed Lock ----------

/**
 * Simple Redis lock for battle operations (join, start, select).
 * Prevents race conditions.
 */
export async function withBattleLock<T>(
  battleId: string,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lockKey = `battle:lock:${battleId}:${operation}`;
  const redis = getRedis();
  const lockValue = `${Date.now()}-${Math.random()}`;

  // Try to acquire lock (5 second TTL)
  const acquired = await redis.set(lockKey, lockValue, "EX", 5, "NX");
  if (!acquired) {
    throw new Error("Operation in progress, please try again");
  }

  try {
    return await fn();
  } finally {
    // Release lock only if we still own it
    const current = await redis.get(lockKey);
    if (current === lockValue) {
      await redis.del(lockKey);
    }
  }
}
