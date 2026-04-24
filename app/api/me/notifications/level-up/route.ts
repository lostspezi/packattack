import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Notification from "@/models/notification";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const pending = await Notification.find({
      userId,
      category: "achievement",
      acknowledgedAt: null,
    })
      .sort({ createdAt: 1 })
      .limit(5)
      .lean();

    return NextResponse.json({
      notifications: pending.map((n) => ({
        _id: String(n._id),
        title: n.title,
        message: n.message,
        type: n.type,
        entityType: n.entityType,
        entityId: n.entityId,
        meta: n.meta ?? null,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    console.error("[me/notifications/level-up GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { ids?: string[] };
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id) => typeof id === "string" && Types.ObjectId.isValid(id))
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ acknowledged: 0 });
    }
    await connectDB();
    const result = await Notification.updateMany(
      { _id: { $in: ids }, userId, acknowledgedAt: null },
      { $set: { acknowledgedAt: new Date(), read: true } },
    );
    return NextResponse.json({ acknowledged: result.modifiedCount ?? 0 });
  } catch (err) {
    console.error("[me/notifications/level-up PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
