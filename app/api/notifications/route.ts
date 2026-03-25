import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import Notification from "@/models/notification";

const UNREAD_CACHE_TTL = 60; // seconds

function unreadKey(userId: string) {
  return `notifications:unread:${userId}`;
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

  const userId = session.user.id;
  const redis = getRedis();

  try {
    await connectDB();

    const [notifications, total] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId }),
    ]);

    // Try cache for unread count
    let unreadCount: number;
    const cached = await redis.get(unreadKey(userId));
    if (cached !== null) {
      unreadCount = parseInt(cached, 10);
    } else {
      unreadCount = await Notification.countDocuments({ userId, read: false });
      await redis.set(unreadKey(userId), unreadCount, "EX", UNREAD_CACHE_TTL);
    }

    return NextResponse.json({
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
    });
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

  const userId = session.user.id;
  const redis = getRedis();

  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, id } = body;

  try {
    await connectDB();

    if (action === "markRead") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      await Notification.findOneAndUpdate(
        { _id: id, userId },
        { read: true }
      );
      await redis.del(unreadKey(userId));
      return NextResponse.json({ ok: true });
    }

    if (action === "markAllRead") {
      await Notification.updateMany({ userId, read: false }, { read: true });
      await redis.del(unreadKey(userId));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[notifications POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
