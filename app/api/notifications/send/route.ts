import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import User from "@/models/user";
import Notification from "@/models/notification";

interface SendBody {
  recipient?: {
    type?: "user" | "role" | "all";
    value?: string;
  };
  title?: string;
  message?: string;
  type?: "info" | "success" | "warning" | "error";
  cta?: { label?: string; url?: string } | null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { recipient, title, message, type, cta } = body;

  if (!title || !message || !type) {
    return NextResponse.json(
      { error: "title, message, and type are required" },
      { status: 400 }
    );
  }

  const validTypes = ["info", "success", "warning", "error"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const recipientType = recipient?.type ?? "all";
  const recipientValue = recipient?.value ?? "";

  try {
    await connectDB();

    let userIds: string[] = [];

    if (recipientType === "user") {
      if (!recipientValue) {
        return NextResponse.json(
          { error: "recipient.value required for type=user" },
          { status: 400 }
        );
      }
      const user = await User.findOne({
        $or: [
          { username: recipientValue },
          { email: recipientValue },
        ],
      })
        .select("_id")
        .lean();
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      userIds = [user._id.toString()];
    } else if (recipientType === "role") {
      if (!recipientValue) {
        return NextResponse.json(
          { error: "recipient.value required for type=role" },
          { status: 400 }
        );
      }
      const users = await User.find({ role: recipientValue })
        .select("_id")
        .lean();
      userIds = users.map((u) => u._id.toString());
    } else if (recipientType === "all") {
      const users = await User.find({}).select("_id").lean();
      userIds = users.map((u) => u._id.toString());
    } else {
      return NextResponse.json(
        { error: "Invalid recipient type" },
        { status: 400 }
      );
    }

    if (userIds.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const ctaData =
      cta?.label && cta?.url
        ? { label: cta.label, url: cta.url }
        : null;

    const docs = userIds.map((userId) => ({
      userId,
      title,
      message,
      type,
      cta: ctaData,
      read: false,
    }));

    await Notification.insertMany(docs);

    // Update cache and push real-time SSE updates for all affected users
    const redis = getRedis();
    const pipeline = redis.pipeline();
    for (const userId of userIds) {
      const count = await Notification.countDocuments({ userId, read: false });
      pipeline.set(`notifications:unread:${userId}`, count, "EX", 60);
      pipeline.publish(
        `notifications:${userId}`,
        JSON.stringify({ unreadCount: count })
      );
    }
    await pipeline.exec();

    return NextResponse.json({ count: userIds.length });
  } catch (err) {
    console.error("[notifications/send POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
