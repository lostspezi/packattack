import { createHash } from "crypto";
import { getRedis } from "@/lib/redis";

const FEEDBACK_BURST_LIMIT = 2;
const FEEDBACK_BURST_WINDOW_SECONDS = 5 * 60;
const FEEDBACK_HOURLY_LIMIT = 6;
const FEEDBACK_HOURLY_WINDOW_SECONDS = 60 * 60;
const FEEDBACK_DUPLICATE_WINDOW_SECONDS = 15 * 60;

export interface FeedbackRateLimitResult {
  allowed: boolean;
  error?: string;
}

async function incrementCounter(key: string, ttlSeconds: number): Promise<number> {
  const redis = getRedis();
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }

  return count;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function assertFeedbackSubmissionAllowed(input: {
  userId: string;
  ipAddress: string;
  title: string;
  description: string;
}): Promise<FeedbackRateLimitResult> {
  try {
    const userBurst = await incrementCounter(`feedback:create:user:${input.userId}:burst`, FEEDBACK_BURST_WINDOW_SECONDS);
    if (userBurst > FEEDBACK_BURST_LIMIT) {
      return { allowed: false, error: "Please wait a few minutes before submitting another ticket." };
    }

    const userHourly = await incrementCounter(`feedback:create:user:${input.userId}:hour`, FEEDBACK_HOURLY_WINDOW_SECONDS);
    if (userHourly > FEEDBACK_HOURLY_LIMIT) {
      return { allowed: false, error: "You've reached the ticket limit for now. Please try again later." };
    }

    const ipBurst = await incrementCounter(`feedback:create:ip:${input.ipAddress}:burst`, FEEDBACK_BURST_WINDOW_SECONDS);
    if (ipBurst > FEEDBACK_BURST_LIMIT * 2) {
      return { allowed: false, error: "Too many feedback submissions from this connection. Please slow down." };
    }

    const fingerprint = createHash("sha256")
      .update(`${normalizeText(input.title)}\n${normalizeText(input.description)}`)
      .digest("hex");

    const redis = getRedis();
    const duplicateKey = `feedback:create:dedupe:${input.userId}:${fingerprint}`;
    const duplicateResult = await redis.set(duplicateKey, "1", "EX", FEEDBACK_DUPLICATE_WINDOW_SECONDS, "NX");

    if (duplicateResult !== "OK") {
      return { allowed: false, error: "This ticket looks like a recent duplicate. Please update your existing ticket instead." };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export function getRequestIpAddress(forwardedFor: string | null): string {
  const raw = forwardedFor?.split(",")[0]?.trim();
  return raw || "unknown";
}
