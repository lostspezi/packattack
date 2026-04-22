import { createHash } from "node:crypto";
import { runRedisCommand } from "@/lib/redis";
import type { ChatTrustTier } from "@/lib/chat-constants";

interface ChatRateLimitInput {
  userId: string;
  normalizedBody: string;
  trustTier: ChatTrustTier;
  slowModeSeconds: number;
  lastSubmittedAt: Date | null;
}

interface ChatRateLimitResult {
  allowed: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

const RATE_WINDOW_SECONDS = 20;

function getWindowLimit(trustTier: ChatTrustTier): number {
  switch (trustTier) {
    case "new":
      return 4;
    case "trusted":
      return 10;
    case "staff":
      return 20;
    default:
      return 8;
  }
}

export async function assertChatSubmissionAllowed({
  userId,
  normalizedBody,
  trustTier,
  slowModeSeconds,
  lastSubmittedAt,
}: ChatRateLimitInput): Promise<ChatRateLimitResult> {
  if (slowModeSeconds > 0 && lastSubmittedAt) {
    const retryAfter = slowModeSeconds - Math.floor((Date.now() - lastSubmittedAt.getTime()) / 1000);
    if (retryAfter > 0) {
      return {
        allowed: false,
        error: "slow_mode_active",
        retryAfterSeconds: retryAfter,
      };
    }
  }

  const windowKey = `chat:rate:${userId}`;
  const duplicateKey = `chat:dup:${userId}`;
  const windowLimit = getWindowLimit(trustTier);
  const hash = createHash("sha256").update(normalizedBody).digest("hex");

  // Single-roundtrip rate + duplicate check: atomically INCR the window
  // counter (setting the TTL only on first hit so the window genuinely
  // expires), then GET the previous duplicate hash and SET the new one.
  const [windowCount, duplicatePrev] = await runRedisCommand<[number, string | null]>(
    `chat:rate:${userId}`,
    [0, null],
    async (redis) => {
      const result = await redis.eval(
        `local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local prev = redis.call('GET', KEYS[2])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return { count, prev }`,
        2,
        windowKey,
        duplicateKey,
        String(RATE_WINDOW_SECONDS),
        hash,
        "120",
      );
      const arr = result as [number | string, string | null];
      return [Number(arr[0]) || 0, arr[1] ?? null];
    }
  );

  if (windowCount > windowLimit) {
    return {
      allowed: false,
      error: "rate_limited",
      retryAfterSeconds: RATE_WINDOW_SECONDS,
    };
  }

  if (duplicatePrev === hash) {
    return {
      allowed: false,
      error: "duplicate_message",
      retryAfterSeconds: 5,
    };
  }

  return { allowed: true };
}
