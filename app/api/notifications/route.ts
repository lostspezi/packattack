import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { runRedisCommand } from "@/lib/redis";
import Notification from "@/models/notification";
import User from "@/models/user";

export const dynamic = "force-dynamic";

interface SessionUserIdentity {
  id?: string | null;
  email?: string | null;
}

const UNREAD_CACHE_TTL = 60;

function unreadKey(userId: string) {
  return `notifications:unread:${userId}`;
}

async function resolveNotificationUserId(identity: SessionUserIdentity): Promise<string | null> {
  const id = identity.id?.trim();
  const email = identity.email?.trim().toLowerCase();

  let userIdFromSession: string | null = null;
  if (id && /^[a-f\d]{24}$/i.test(id)) {
    const byId = await User.findById(id).select("_id").lean();
    userIdFromSession = byId?._id?.toString() ?? null;
  }

  let userIdFromEmail: string | null = null;
  if (email) {
    const byEmail = await User.findOne({ email }).select("_id").lean();
    userIdFromEmail = byEmail?._id?.toString() ?? null;
  }

  // If session id and email resolve to different users, trust email to avoid stale-token misses.
  if (userIdFromSession && userIdFromEmail && userIdFromSession !== userIdFromEmail) {
    return userIdFromEmail;
  }

  return userIdFromSession ?? userIdFromEmail ?? id ?? null;
}

async function setUnreadCache(userId: string, unreadCount: number): Promise<void> {
  await runRedisCommand<void>(
    `notifications:set-unread:${userId}`,
    undefined,
    async (redis) => {
      await redis.set(unreadKey(userId), unreadCount, "EX", UNREAD_CACHE_TTL);
    }
  );
}

async function publishUnreadCount(userId: string, unreadCount: number): Promise<void> {
  await runRedisCommand<void>(
    `notifications:publish-unread:${userId}`,
    undefined,
    async (redis) => {
      await redis.publish(`notifications:${userId}`, JSON.stringify({ unreadCount }));
    }
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  try {
    await connectDB();

    const userId = await resolveNotificationUserId({
      id: session.user.id,
      email: session.user.email ?? null,
    });
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [notifications, total] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId }),
    ]);

    const cachedUnread = await runRedisCommand<string | null>(
      `notifications:get-unread:${userId}`,
      null,
      async (redis) => redis.get(unreadKey(userId))
    );

    let unreadCount: number;
    if (cachedUnread !== null) {
      unreadCount = parseInt(cachedUnread, 10);
    } else {
      unreadCount = await Notification.countDocuments({ userId, read: false });
      await setUnreadCache(userId, unreadCount);
    }

    return NextResponse.json(
      {
        notifications: notifications.map((n) => ({
          id: n._id.toString(),
          title: n.title,
          message: n.message,
          type: n.type,
          cta: n.cta ?? null,
          read: n.read,
          createdAt: n.createdAt,
        })),
        total,
        page,
        limit,
        unreadCount,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("[notifications GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, id } = body;

  try {
    await connectDB();

    const userId = await resolveNotificationUserId({
      id: session.user.id,
      email: session.user.email ?? null,
    });
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "markRead") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      await Notification.findOneAndUpdate({ _id: id, userId }, { read: true });
      const count = await Notification.countDocuments({ userId, read: false });
      await setUnreadCache(userId, count);
      await publishUnreadCount(userId, count);
      return NextResponse.json({ ok: true });
    }

    if (action === "markAllRead") {
      await Notification.updateMany({ userId, read: false }, { read: true });
      await setUnreadCache(userId, 0);
      await publishUnreadCount(userId, 0);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      await Notification.findOneAndDelete({ _id: id, userId });
      const count = await Notification.countDocuments({ userId, read: false });
      await setUnreadCache(userId, count);
      await publishUnreadCount(userId, count);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[notifications POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
