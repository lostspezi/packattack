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

  const windowCount = await runRedisCommand<number>(
    `chat:rate:${userId}`,
    0,
    async (redis) => {
      const count = await redis.incr(windowKey);
      if (count === 1) {
        await redis.expire(windowKey, RATE_WINDOW_SECONDS);
      }
      return count;
    }
  );

  if (windowCount > windowLimit) {
    return {
      allowed: false,
      error: "rate_limited",
      retryAfterSeconds: RATE_WINDOW_SECONDS,
    };
  }

  const duplicateMatch = await runRedisCommand<boolean>(
    `chat:dup:${userId}`,
    false,
    async (redis) => {
      const previous = await redis.get(duplicateKey);
      await redis.set(duplicateKey, hash, "EX", 120);
      return previous === hash;
    }
  );

  if (duplicateMatch) {
    return {
      allowed: false,
      error: "duplicate_message",
      retryAfterSeconds: 5,
    };
  }

  return { allowed: true };
}
