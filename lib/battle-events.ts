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
  /** Redis Stream entry ID — populated on publish so SSE clients can use it
   *  as the SSE `id:` field and replay missed events after reconnect. */
  streamId?: string;
}

// ---------- Channel ----------

function channelKey(battleId: string): string {
  return `battle:${battleId}`;
}

export function streamKey(battleId: string): string {
  return `battle:events:${battleId}`;
}

// Stream retention: ~500 entries per battle, whole key expires after 10 min.
// A full battle (7 rounds × 4 players × events-per-round) stays well under 500.
const STREAM_MAXLEN = 500;
const STREAM_TTL_SECONDS = 600;

// ---------- Publish ----------

export async function publishBattleEvent(
  battleId: string,
  type: BattleEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const event: BattleEvent = { type, data, timestamp: Date.now() };
  const redis = getRedis();
  const key = streamKey(battleId);

  try {
    // XADD first so the stream ID is known when we broadcast it.
    const streamId = (await redis.xadd(
      key,
      "MAXLEN",
      "~",
      STREAM_MAXLEN,
      "*",
      "data",
      JSON.stringify(event),
    )) as string | null;

    if (streamId) {
      event.streamId = streamId;
      // Refresh TTL on every publish — keeps the stream alive during the
      // battle but lets it expire shortly after the last event.
      await redis.expire(key, STREAM_TTL_SECONDS);
    }

    await redis.publish(channelKey(battleId), JSON.stringify(event));
  } catch (err) {
    console.warn(`[battle-events] publish failed for ${battleId}:`, err);
  }
}

/**
 * Replay events from the Redis Stream that occurred after `afterStreamId`.
 * Used by the SSE route when a client reconnects with a Last-Event-ID header.
 * Returns entries as [streamId, rawEventJson] tuples in chronological order.
 */
export async function replayBattleEventsAfter(
  battleId: string,
  afterStreamId: string,
): Promise<Array<{ streamId: string; rawData: string }>> {
  const redis = getRedis();
  try {
    // `(id` makes the range exclusive of the caller's last seen ID.
    const entries = (await redis.xrange(
      streamKey(battleId),
      `(${afterStreamId}`,
      "+",
    )) as Array<[string, string[]]>;

    return entries.map(([id, fields]) => {
      const dataIdx = fields.indexOf("data");
      const rawData = dataIdx >= 0 ? fields[dataIdx + 1] : "";
      return { streamId: id, rawData };
    });
  } catch (err) {
    console.warn(`[battle-events] replay failed for ${battleId}:`, err);
    return [];
  }
}

// ---------- Subscribe ----------

/**
 * Create a dedicated Redis subscriber for a battle channel.
 * Returns subscriber client and cleanup function.
 * Uses getRedis().duplicate() so the subscriber inherits the singleton's config.
 */
export function subscribeToBattle(
  battleId: string,
  onMessage: (event: BattleEvent) => void,
): { subscriber: Redis; unsubscribe: () => void } {
  const subscriber = getRedis().duplicate();

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
