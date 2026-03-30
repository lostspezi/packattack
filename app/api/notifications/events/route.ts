import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getRedis } from "@/lib/redis";
import connectDB from "@/lib/db";
import Notification from "@/models/notification";
import User from "@/models/user";

export const dynamic = "force-dynamic";

const UNREAD_CACHE_TTL = 60;

interface SessionUserIdentity {
  id?: string | null;
  email?: string | null;
}

async function resolveNotificationUserId(identity: SessionUserIdentity): Promise<string | null> {
  const email = identity.email?.trim().toLowerCase();
  if (email) {
    const dbUser = await User.findOne({ email }).select("_id").lean();
    if (dbUser?._id) {
      return dbUser._id.toString();
    }
  }

  return identity.id ?? null;
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectDB();
  const userId = await resolveNotificationUserId({
    id: session.user.id,
    email: session.user.email ?? null,
  });
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const channel = `notifications:${userId}`;
  const cacheKey = `notifications:unread:${userId}`;

  const encoder = new TextEncoder();
  let subscriberRedis: ReturnType<typeof getRedis> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Send initial unread count
      try {
        const redis = getRedis();
        let unreadCount: number;
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          unreadCount = parseInt(cached, 10);
        } else {
          unreadCount = await Notification.countDocuments({
            userId,
            read: false,
          });
          await redis.set(cacheKey, unreadCount, "EX", UNREAD_CACHE_TTL);
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ unreadCount })}\n\n`)
        );
      } catch {
        // Continue even if initial count fails
      }

      // Subscribe to user's notification channel
      subscriberRedis = getRedis().duplicate();

      subscriberRedis.on("message", (_ch: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          // Stream closed
        }
      });

      await subscriberRedis.subscribe(channel);

      // Keepalive every 30s
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 30000);

      // Cleanup on abort
      _req.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        if (subscriberRedis) {
          subscriberRedis.unsubscribe(channel).catch(() => {});
          subscriberRedis.disconnect();
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (subscriberRedis) {
        subscriberRedis.unsubscribe(channel).catch(() => {});
        subscriberRedis.disconnect();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
